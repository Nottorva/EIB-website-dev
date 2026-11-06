// The orchestrator: one received email in, zero or more emails out. Called by the inbound route after the
// webhook has been verified and deduplicated.

import { agentConfig, SIGNATURE, MAX_REPLIES_PER_THREAD_PER_HOUR, THREAD_CONTEXT_MESSAGES, DRAFT_EXPIRY_DAYS } from "./config";
import { isAutomatedMail, reSubject, sendMail } from "./mail";
import { classifySender, agentOnlyCcd, otherParticipants } from "./classify";
import { runAnswer, classifyJosefIntent, relayAnswer } from "./claude";
import { buildDraft, commitDraft, confirmMessage, undoDraft, commitUndo } from "./edits";
import { getThread, saveThread, createEscalation, findEscalation, updateEscalation, saveFaq, newId } from "./db";

const now = () => new Date().toISOString();
const shortId = () => Math.random().toString(36).slice(2, 7);

function rootIdOf(email) {
  return email.references[0] || email.inReplyTo || email.messageId || `<${email.id}@resend>`;
}

async function loadThread(email) {
  const rootId = rootIdOf(email);
  const existing = await getThread(rootId);
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
  thread.sent = [...(thread.sent || []), { at: now(), to, cc: ccList, messageId: r.messageId, text: text.slice(0, 2000) }];
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

  const sender = classifySender(email);
  log.sender = sender.kind;
  const thread = await loadThread(email);

  // CC mode: read quietly, unless verified Josef addresses the assistant explicitly.
  if (agentOnlyCcd(email)) {
    const addressed = sender.kind === "josef" && /\b(assistant|eib assistant)\b[,:]?\s/i.test(email.text || "");
    if (!addressed) {
      thread.mode = thread.mode || "context";
      await saveThread(thread);
      return { ...log, outcome: "stored as context (CC only)" };
    }
  }

  if (repliesInLastHour(thread) >= MAX_REPLIES_PER_THREAD_PER_HOUR) {
    await saveThread(thread);
    return { ...log, outcome: "rate cap: no reply" };
  }

  let outcome;
  try {
    if (sender.kind === "josef") outcome = await handleJosef(email, thread);
    else if (sender.kind === "tfs") outcome = await handleStaff(email, thread, sender);
    else outcome = await handleUnknown(email, thread, sender);
  } finally {
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
    `What I found: ${result.what_you_found || "nothing in joineib or the docs folder"}`,
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

  // Expire stale drafts.
  if (thread.draft && Date.parse(thread.draft.createdAt) < Date.now() - DRAFT_EXPIRY_DAYS * 86400_000) thread.draft = null;

  const intent = await classifyJosefIntent({ email, pendingDraft: thread.draft });
  const josefReply = (text) => reply(thread, email, { to: [email.from.email], cc: [], text });

  if (intent.intent === "confirm") {
    if (!thread.draft) {
      await josefReply("There is nothing waiting for a yes in this thread.");
      return "confirm with no draft";
    }
    const draft = thread.draft;
    try {
      const done = draft.action === "undo" ? await commitUndo(draft, email.messageId) : await commitDraft(draft, email.messageId);
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
  if (intent.intent === "undo") {
    const r = await undoDraft(intent.edit.target_name);
    if (r.status !== "ready") {
      await josefReply(r.message);
      return `undo: ${r.status}`;
    }
    thread.draft = r.draft;
    thread.mode = "edit";
    await josefReply(r.message);
    return "undo proposed, awaiting YES";
  }
  if (intent.intent === "edit") {
    const existing = thread.draft && thread.draft.action !== "undo" && (intent.edit.action === "update_draft" || !intent.edit.target_name || intent.edit.target_name.toLowerCase() === String(thread.draft.targetName).toLowerCase()) ? thread.draft : null;
    const r = await buildDraft({ edit: intent.edit, existingDraft: existing });
    if (r.status === "not_found" || r.status === "ambiguous") {
      await josefReply(r.message);
      return `edit: ${r.status}`;
    }
    thread.draft = r.draft;
    thread.mode = "edit";
    await josefReply(r.message);
    return r.status === "ready" ? "edit drafted, awaiting YES" : `edit: asked for ${r.draft.missing.join(", ")}`;
  }
  if (intent.intent === "other" && thread.draft) {
    // A correction in prose: treat as more fields for the draft via the intent extractor's field map.
    const r = await buildDraft({ edit: { ...intent.edit, action: "update_draft" }, existingDraft: thread.draft });
    thread.draft = r.draft;
    await josefReply(r.status === "ready" ? await confirmMessage(r.draft) : r.message);
    return "draft corrected";
  }
  // A question from Josef: full access.
  thread.mode = "answer";
  const result = await runAnswer({ email, senderKind: "josef", senderName: cfg.josefName, threadContext: threadContext(thread) });
  if (result.action === "escalate") {
    await josefReply(`I could not answer that from joineib or the documents folder. ${result.what_you_found || ""}`.trim());
    return "josef question: no answer in data";
  }
  if (result.action === "reply") {
    await josefReply(result.text);
    return "josef question answered";
  }
  await josefReply("I only handle EIB logistics questions.");
  return `josef: ${result.action}`;
}
