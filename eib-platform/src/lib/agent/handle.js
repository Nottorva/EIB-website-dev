// The orchestrator: one received email in, zero or more emails out. Called by the inbound route after the
// webhook has been verified and deduplicated.

import { agentConfig, SIGNATURE, MAX_REPLIES_PER_THREAD_PER_HOUR, THREAD_CONTEXT_MESSAGES, DRAFT_EXPIRY_DAYS } from "./config";
import { isAutomatedMail, reSubject, sendMail } from "./mail";
import { classifySender, agentOnlyCcd, otherParticipants } from "./classify";
import { runAnswer, classifyJosefIntent, relayAnswer, timed } from "./claude";
import { buildDraft, commitDraft, confirmMessage, undoDraft, commitUndo } from "./edits";
import { getThread, listThreads, saveThread, createEscalation, findEscalation, updateEscalation, saveFaq } from "./db";
import { describeAccess, grantAccess, revokeAccess } from "./access";

const now = () => new Date().toISOString();
const shortId = () => Math.random().toString(36).slice(2, 7);

const normSubject = (s) =>
  String(s || "")
    .replace(/^\s*((re|fwd?|tr|aw)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();

/**
 * Find the thread this email belongs to. In order: the References/In-Reply-To headers against thread roots,
 * then against every message id the thread has seen or sent (including Resend's send ids, which appear
 * inside the Message-ID Resend assigns), then a recent thread from the same sender with the same subject.
 * Without that last fallback a reply whose headers were stripped would start a new thread and lose the
 * pending draft.
 */
async function findThread(email) {
  const ids = [...email.references, email.inReplyTo].filter(Boolean);
  for (const id of ids) {
    const t = await getThread(id);
    if (t) return { thread: t, how: "root id" };
  }
  const all = await listThreads(() => true);
  if (ids.length) {
    const hit = all.find((t) => (t.messages || []).some((m) => ids.includes(m.messageId)) || (t.sent || []).some((s) => ids.includes(s.messageId) || (s.resendId && ids.some((id) => id.includes(s.resendId)))));
    if (hit) return { thread: hit, how: "message id" };
  }
  const subject = normSubject(email.subject);
  const cutoff = Date.now() - 14 * 86400_000;
  const recentFromSender = all.filter((t) => Date.parse(t.updatedAt || 0) > cutoff && (t.participants || []).includes(email.from.email)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (subject) {
    const same = recentFromSender.find((t) => normSubject(t.subject) === subject);
    if (same) return { thread: same, how: "sender and subject" };
  }
  // Last resort: the quoted reply in the body contains text the agent sent earlier.
  const body = String(email.fullText || "").replace(/\s+/g, " ");
  if (body.includes("EIB Assistant (AI)")) {
    for (const t of recentFromSender) {
      const lastSent = (t.sent || [])[t.sent.length - 1];
      const probe = String(lastSent?.text || "").replace(/\s+/g, " ").slice(0, 80);
      if (probe.length > 20 && body.includes(probe)) return { thread: t, how: "quoted body" };
    }
  }
  return { thread: null, how: "new" };
}

/** The pending step of a thread, with its expiry applied. */
function pendingOf(thread) {
  const d = thread.draft;
  if (!d) return null;
  if (d.expiresAt && Date.parse(d.expiresAt) < Date.now()) {
    thread.draft = null;
    return null;
  }
  return d;
}

function setPending(thread, draft, awaiting) {
  thread.draft = { ...draft, awaiting, expiresAt: new Date(Date.now() + DRAFT_EXPIRY_DAYS * 86400_000).toISOString() };
  thread.mode = "edit";
}

const YES_RE = /^\s*(yes|yes[.!]*|y|yep|yeah|yup|confirmed?|go ahead|do it|save( it)?|looks good|correct|ok(ay)?|oui|d'accord)\b[\s.!]*$/i;
const NO_RE = /^\s*(no|nope|cancel|never mind|nevermind|forget it|stop|don'?t|non|annule[rz]?)\b[\s.!]*$/i;

async function loadThread(email) {
  const found = await findThread(email);
  const rootId = found.thread?.rootId || email.messageId || `<${email.id}@resend>`;
  console.log(`[eib agent] thread ${rootId} (${found.how}; in-reply-to ${email.inReplyTo || "none"}, refs ${email.references.length})`);
  const existing = found.thread;
  const thread = existing || { rootId, subject: email.subject, participants: [], mode: "", messages: [], sent: [], draft: null };
  const ids = new Set(thread.participants);
  ids.add(email.from.email);
  thread.participants = [...ids];
  thread.messages = [...(thread.messages || []), { from: email.from.email, name: email.from.name, at: now(), subject: email.subject, text: (email.text || email.fullText).slice(0, 4000), messageId: email.messageId }].slice(-30);
  return thread;
}

function threadContext(thread) {
  return (thread.messages || [])
    .slice(-THREAD_CONTEXT_MESSAGES, -1)
    .map((m) => `[${m.at.slice(0, 16)}] ${m.name || m.from}: ${m.text}`)
    .join("\n\n");
}

function repliesInLastHour(thread) {
  const cutoff = Date.now() - 3600_000;
  return (thread.sent || []).filter((s) => Date.parse(s.at) > cutoff).length;
}

async function reply(thread, email, { to, cc, text, subject }) {
  const cfg = agentConfig();
  const body = `${text.trim()}\n\n--\n${SIGNATURE(cfg.josefName)}`;
  const ccList = [...new Set((cc || []).filter((e) => e && e !== cfg.address && !to.includes(e)))];
  const r = await sendMail({ to, cc: ccList, subject: subject || reSubject(email.subject), text: body, inReplyTo: email.messageId, references: email.references });
  thread.sent = [...(thread.sent || []), { at: now(), to, cc: ccList, messageId: r.messageId, resendId: r.id, text: text.slice(0, 2000) }];
  return r;
}

/** Everyone else on the original email plus Josef: he is CC'd on every reply not addressed only to him. */
function ccForAsker(email) {
  const cfg = agentConfig();
  return [...otherParticipants(email).filter((e) => e !== email.from.email), ...cfg.josefAddresses.slice(0, 1)];
}

/**
 * Returns a short log entry describing what happened.
 */
export async function handleEmail(email) {
  const cfg = agentConfig();
  const log = { from: email.from.email, subject: email.subject };

  // Loop prevention.
  if (email.from.email === cfg.address) return { ...log, outcome: "ignored: sent by the agent itself" };
  const automated = isAutomatedMail(email);
  if (automated) return { ...log, outcome: `ignored: ${automated}` };

  const sender = await timed("classify sender", () => classifySender(email));
  log.sender = sender.kind;
  const thread = await timed("load thread", () => loadThread(email));
  thread.lastFrom = email.from.email;
  thread.lastAt = now();

  // CC mode: read quietly, unless verified Josef addresses the assistant explicitly.
  if (agentOnlyCcd(email)) {
    const addressed = sender.kind === "josef" && /\b(assistant|eib assistant)\b[,:]?\s/i.test(email.text || "");
    if (!addressed) {
      thread.mode = thread.mode || "context";
      thread.lastOutcome = "stored as context (CC only)";
      await saveThread(thread);
      return { ...log, outcome: thread.lastOutcome };
    }
  }

  if (repliesInLastHour(thread) >= MAX_REPLIES_PER_THREAD_PER_HOUR) {
    thread.lastOutcome = "rate cap: no reply";
    await saveThread(thread);
    return { ...log, outcome: thread.lastOutcome };
  }

  let outcome;
  try {
    if (sender.kind === "josef") outcome = await handleJosef(email, thread);
    else if (sender.kind === "tfs") outcome = await handleStaff(email, thread, sender);
    else outcome = await handleUnknown(email, thread, sender);
  } catch (e) {
    outcome = `error: ${e.message}`;
    // Best effort: tell Josef which step failed, so a silent failure never happens twice.
    try {
      await sendMail({ to: cfg.josefAddresses, subject: `[EIB agent error] ${email.subject}`, text: `I could not finish handling an email from ${email.from.email} (${sender.kind}).\n\nStep: ${e.step || "unknown"}\nError: ${e.message}\n\nThe email:\n${(email.text || email.fullText).slice(0, 2000)}` });
    } catch (e2) {
      console.error(`[eib agent] could not send the error email either: ${e2?.message || e2}`);
    }
    throw e;
  } finally {
    thread.lastOutcome = outcome;
    thread.senderKind = sender.kind;
    await saveThread(thread);
  }
  return { ...log, outcome };
}

// ---------------------------------------------------------------------------
// Unknown senders: one short reply, forward to Josef, nothing from the data.
// ---------------------------------------------------------------------------
async function handleUnknown(email, thread, sender) {
  const cfg = agentConfig();
  thread.mode = "forwarded";
  await reply(thread, email, { to: [email.from.email], cc: cfg.josefAddresses.slice(0, 1), text: "Thanks, I've passed this to Josef." });
  await sendMail({
    to: cfg.josefAddresses,
    subject: `[EIB fwd${sender.lookalike ? ", suspicious" : ""}] ${email.subject}`,
    text: `${sender.lookalike ? "WARNING: this email claims to be from one of your addresses but failed authentication. Treat it as unknown.\n\n" : ""}From: ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}\nWhy forwarded: ${sender.why}\n\n${email.fullText}\n\n--\n${SIGNATURE(cfg.josefName)}`,
  });
  return sender.lookalike ? "lookalike Josef: forwarded as suspicious, nothing written" : "unknown sender: acknowledged and forwarded";
}

// ---------------------------------------------------------------------------
// Whitelisted staff: answer or escalate.
// ---------------------------------------------------------------------------
async function handleStaff(email, thread, sender) {
  thread.mode = "answer";
  const result = await runAnswer({ email, senderKind: sender.kind, senderName: email.from.name, threadContext: threadContext(thread) });
  return applyAnswer(email, thread, sender, result);
}

async function applyAnswer(email, thread, sender, result) {
  const cfg = agentConfig();
  const cc = ccForAsker(email);
  switch (result.action) {
    case "reply":
      await reply(thread, email, { to: [email.from.email], cc, text: result.text });
      return `answered (${result.toolCalls.map((t) => t.name).join(", ") || "no tools"})`;
    case "out_of_scope":
      await reply(thread, email, { to: [email.from.email], cc, text: "I only handle EIB questions, so I've passed this to Josef." });
      await sendMail({ to: cfg.josefAddresses, subject: `[EIB fwd, out of scope] ${email.subject}`, text: `From: ${email.from.email}\n\n${email.fullText}` });
      return "out of scope: forwarded";
    case "suspicious":
      await sendMail({ to: cfg.josefAddresses, subject: `[EIB fwd, suspicious] ${email.subject}`, text: `This email tried to change the assistant's rules (${result.reason}). No reply was sent.\n\nFrom: ${email.from.email}\n\n${email.fullText}` });
      return "suspicious: forwarded, no reply";
    case "escalate":
    default:
      return escalate(email, thread, sender, result);
  }
}

async function escalate(email, thread, sender, result) {
  const cfg = agentConfig();
  const id = shortId();
  thread.mode = "escalated";
  const askerCc = ccForAsker(email);
  await reply(thread, email, { to: [email.from.email], cc: askerCc, text: "I'm checking with Josef and will get back to you." });
  const subject = `[EIB Q-${id}] ${(result.question_summary || email.subject).slice(0, 80)}`;
  const text = [
    `${email.from.name || email.from.email} (${email.from.email}) asked:`,
    "",
    email.text || email.fullText,
    "",
    `What I found: ${result.what_you_found || "nothing on the EIB platform or in the documents folder"}`,
    result.draft_read ? `\nDRAFT (my first read, for you to check): ${result.draft_read}` : "",
    "",
    "Reply to this email in plain language and I will pass your answer to them in their thread. Say \"don't save this\" if it should not go in the FAQ.",
    "",
    "--",
    SIGNATURE(cfg.josefName),
  ].join("\n");
  const sent = await sendMail({ to: cfg.josefAddresses, subject, text });
  await createEscalation({ shortId: id, askerEmail: email.from.email, askerName: email.from.name, askerCc, askerThreadRoot: thread.rootId, askerMessageId: email.messageId, askerReferences: email.references, askerSubject: email.subject, question: email.text || email.fullText, josefMessageId: sent.messageId, josefSubject: subject });
  return `escalated as Q-${id}`;
}

// ---------------------------------------------------------------------------
// Verified Josef: escalation answers, edits, undo, confirmations, questions.
// ---------------------------------------------------------------------------
async function handleJosef(email, thread) {
  const cfg = agentConfig();
  // An answer to an open escalation?
  const q = /\[EIB Q-([a-z0-9]+)\]/i.exec(email.subject)?.[1];
  const esc = q ? await findEscalation((e) => e.shortId === q.toLowerCase() && e.status === "open") : null;
  if (esc) {
    const r = await relayAnswer({ question: esc.question, josefReply: email.text || email.fullText, askerName: esc.askerName || esc.askerEmail });
    const askerEmail = { messageId: esc.askerMessageId, references: esc.askerReferences || [], subject: esc.askerSubject };
    const body = `${r.answer.trim()}\n\n--\n${SIGNATURE(cfg.josefName)}`;
    await sendMail({ to: [esc.askerEmail], cc: (esc.askerCc || []).filter((e) => e !== esc.askerEmail), subject: reSubject(askerEmail.subject), text: body, inReplyTo: askerEmail.messageId, references: askerEmail.references });
    const askerThread = await getThread(esc.askerThreadRoot);
    if (askerThread) {
      askerThread.sent = [...(askerThread.sent || []), { at: now(), to: [esc.askerEmail], text: r.answer.slice(0, 2000) }];
      askerThread.mode = "answered";
      await saveThread(askerThread);
    }
    const dontSave = /don'?t save|do not save|ne pas (enregistrer|sauvegarder)/i.test(email.text || "");
    const saved = r.save_to_faq && !dontSave;
    if (saved) await saveFaq({ question: esc.question, answer: r.answer, askedBy: esc.askerEmail, escalationId: esc.id });
    await updateEscalation(esc.id, { status: "answered", answeredAt: now(), answer: r.answer, savedToFaq: saved });
    thread.mode = "escalation-answer";
    return `relayed Josef's answer for Q-${q}${saved ? " and saved to FAQ" : ""}`;
  }

  const pending = pendingOf(thread);
  const josefReply = (text) => reply(thread, email, { to: [email.from.email], cc: [], text });
  const firstLine = String(email.text || "").trim();

  // A pending step is answered before any fresh intent detection: YES/NO are decided in code.
  let intent;
  if (pending && pending.awaiting === "confirm" && YES_RE.test(firstLine)) intent = { intent: "confirm", edit: { target_kind: "", target_name: "", action: "", fields: {}, dont_save_faq: false } };
  else if (pending && NO_RE.test(firstLine)) intent = { intent: "cancel", edit: { target_kind: "", target_name: "", action: "", fields: {}, dont_save_faq: false } };
  else intent = await classifyJosefIntent({ email, pendingDraft: pending });
  if (pending && pending.awaiting === "details" && (intent.intent === "other" || intent.intent === "question" || intent.intent === "confirm")) {
    // Still gathering: whatever he wrote is treated as the answer to the questions, never as a new request.
    intent = { ...intent, intent: "edit", edit: { ...intent.edit, action: "update_draft", target_kind: pending.kind, target_name: pending.targetName } };
  }
  console.log(`[eib agent] josef intent ${intent.intent}${pending ? ` (pending ${pending.kind} ${pending.action}, awaiting ${pending.awaiting})` : ""}`);

  if (intent.intent === "confirm") {
    if (!pending) {
      await josefReply("There is nothing waiting for a yes in this thread.");
      return "confirm with no draft";
    }
    if (pending.awaiting === "details") {
      await josefReply(`I still need the ${pending.missing.join(", ")} before I can save. ${pending.kind === "mentor" ? "Reply with the email address at least." : ""}`.trim());
      return "confirm while details missing";
    }
    const draft = pending;
    try {
      const done =
        draft.kind === "access"
          ? (draft.action === "grant" ? await grantAccess(draft.targetId, { name: draft.fields.name, addedBy: email.from.email }) : await revokeAccess(draft.targetId)).message
          : draft.action === "undo"
            ? await commitUndo(draft, email.messageId)
            : await commitDraft(draft, email.messageId);
      thread.draft = null;
      await josefReply(done);
      return `wrote: ${done}`;
    } catch (e) {
      await josefReply(`I could not save that: ${e.message}\nThe draft is still here; tell me what to change, or reply "cancel".`);
      return `write failed: ${e.message}`;
    }
  }
  if (intent.intent === "cancel") {
    thread.draft = null;
    thread.mode = "edit-cancelled";
    await josefReply("Dropped. Nothing was written.");
    return "draft cancelled";
  }
  if (intent.intent === "access_list") {
    await josefReply(await describeAccess());
    return "access list sent";
  }
  if (intent.intent === "access_add" || intent.intent === "access_remove") {
    const target = String(intent.edit.target_name || "").trim();
    if (!target) {
      await josefReply("Who? Give me an email address or a domain.");
      return "access: no target";
    }
    const draft = { kind: "access", action: intent.intent === "access_add" ? "grant" : "revoke", targetId: target, targetName: target, fields: { name: intent.edit.fields?.name || "" }, missing: [], createdAt: now() };
    setPending(thread, draft, "confirm");
    await josefReply(draft.action === "grant" ? `Give ${target} access to ask me questions${target.includes("@") ? "" : " (everyone at that domain)"}?\n\nReply YES to confirm.` : `Remove ${target}'s access?\n\nReply YES to confirm.`);
    return `access ${draft.action} proposed, awaiting YES`;
  }
  if (intent.intent === "undo") {
    const r = await undoDraft(intent.edit.target_name);
    if (r.status !== "ready") {
      await josefReply(r.message);
      return `undo: ${r.status}`;
    }
    setPending(thread, r.draft, "confirm");
    await josefReply(r.message);
    return "undo proposed, awaiting YES";
  }
  if (intent.intent === "edit") {
    const sameTarget = !intent.edit.target_name || intent.edit.target_name.toLowerCase() === String(thread.draft?.targetName || "").toLowerCase() || String(thread.draft?.targetName || "").toLowerCase().includes(intent.edit.target_name.toLowerCase());
    const existing = thread.draft && thread.draft.action !== "undo" && thread.draft.kind !== "access" && (intent.edit.action === "update_draft" || sameTarget) ? thread.draft : null;
    if (!existing && !intent.edit.target_name && !intent.edit.fields?.name) {
      await josefReply("Which mentor or lesson do you mean? Give me the name, for example: add a mentor, Sarah Chen.");
      return "edit: no target";
    }
    const r = await buildDraft({ edit: intent.edit, existingDraft: existing });
    if (r.status === "not_found" || r.status === "ambiguous") {
      await josefReply(r.message);
      return `edit: ${r.status}`;
    }
    setPending(thread, r.draft, r.status === "ready" ? "confirm" : "details");
    await josefReply(r.message);
    return r.status === "ready" ? "edit drafted, awaiting YES" : `edit: asked for ${r.draft.missing.join(", ")}`;
  }
  if (intent.intent === "other" && pending && pending.kind !== "access") {
    // A correction in prose while a record is waiting for YES: merge whatever fields were found.
    const r = await buildDraft({ edit: { ...intent.edit, action: "update_draft" }, existingDraft: pending });
    setPending(thread, r.draft, r.status === "ready" ? "confirm" : "details");
    await josefReply(r.status === "ready" ? await confirmMessage(r.draft) : r.message);
    return "draft corrected";
  }
  // A question from Josef: full access.
  thread.mode = "answer";
  const result = await runAnswer({ email, senderKind: "josef", senderName: cfg.josefName, threadContext: threadContext(thread) });
  if (result.action === "escalate") {
    await josefReply(`I could not answer that from the EIB platform or the documents folder. ${result.what_you_found || ""}`.trim());
    return "josef question: no answer in data";
  }
  if (result.action === "reply") {
    await josefReply(result.text);
    return "josef question answered";
  }
  await josefReply("I only handle EIB logistics questions.");
  return `josef: ${result.action}`;
}
