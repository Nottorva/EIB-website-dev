// The orchestrator: one received email in, zero or more emails out. Called by the inbound route after the
// webhook has been verified and deduplicated.
//
// Who sent it decides everything. Verified Josef can ask, edit, forward with an instruction, and change memory.
// Whitelisted TFS staff get answers or escalations. Everyone else gets a one-line acknowledgement and a forward
// to Josef. When the agent is not the only recipient it never replies to anyone but Josef.

import { agentConfig, MAX_REPLIES_PER_THREAD_PER_HOUR, THREAD_CONTEXT_MESSAGES, DRAFT_EXPIRY_DAYS } from "./config";
import { isAutomatedMail, reSubject, sendMail, firstLineOf } from "./mail";
import { classifySender, otherParticipants } from "./classify";
import { runAnswer, runForward, classifyJosefIntent, relayAnswer, memoryPass, rememberNote, summarizeEmail, timed } from "./claude";
import { buildDraft, commitDraft, confirmMessage } from "./edits";
import { parseForward } from "./forward";
import { listMemory, isArchived, memoryContext, upsertMemory, forgetMemory, searchMemory, describeMemory } from "./memory";
import { getThread, listThreads, saveThread, createEscalation, findEscalation, updateEscalation } from "./db";
import { describeAccess, grantAccess, revokeAccess } from "./access";
import { compose, composeForJosef, bareBody, firstNameOf, scrubDashes, CRM_URL, MEMORY_URL } from "./style";

const now = () => new Date().toISOString();
const shortId = () => Math.random().toString(36).slice(2, 7);
const EMPTY_EDIT = { target_kind: "", target_name: "", action: "", fields: {}, dont_save_faq: false };

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------
const normSubject = (s) =>
  String(s || "")
    .replace(/^\s*((re|fwd?|tr|aw)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();

/**
 * Find the thread this email belongs to: References/In-Reply-To against thread roots, then against every
 * message id the thread has seen or sent (including Resend's send ids), then a recent thread from the same
 * sender with the same subject, then the quoted reply in the body.
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
  // The fallbacks below are for replies whose headers went missing. A brand-new email (no In-Reply-To, no
  // References, no "Re:" subject, no quoted reply) always starts a new thread.
  const body = String(email.fullText || "").replace(/\s+/g, " ");
  const looksLikeReply = ids.length > 0 || /^\s*(re|tr|aw)\s*:/i.test(email.subject || "") || body.includes("EIB Assistant");
  if (!looksLikeReply) return { thread: null, how: "new" };
  const subject = normSubject(email.subject);
  const cutoff = Date.now() - 14 * 86400_000;
  const recentFromSender = all.filter((t) => Date.parse(t.updatedAt || 0) > cutoff && (t.participants || []).includes(email.from.email)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (subject) {
    const same = recentFromSender.find((t) => normSubject(t.subject) === subject);
    if (same) return { thread: same, how: "sender and subject (reply with missing headers)" };
  }
  if (body.includes("EIB Assistant")) {
    for (const t of recentFromSender) {
      const lastSent = (t.sent || [])[t.sent.length - 1];
      const probe = String(lastSent?.text || "").replace(/\s+/g, " ").slice(0, 80);
      if (probe.length > 20 && body.includes(probe)) return { thread: t, how: "quoted body" };
    }
  }
  return { thread: null, how: "new" };
}

async function loadThread(email) {
  const found = await findThread(email);
  const rootId = found.thread?.rootId || email.messageId || `<${email.id}@resend>`;
  console.log(`[eib agent] thread ${rootId} (${found.how}; in-reply-to ${email.inReplyTo || "none"}, refs ${email.references.length})`);
  const thread = found.thread || { rootId, subject: email.subject, participants: [], mode: "", messages: [], sent: [], draft: null };
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

const YES_RE = /^\s*(yes|y|yep|yeah|yup|confirmed?|go ahead|do it|send( it)?|save( it)?|looks good|correct|ok(ay)?|oui|d'accord)\b[\s.!]*$/i;
const NO_RE = /^\s*(no|nope|cancel|never mind|nevermind|forget it|stop|don'?t|non|annule[rz]?)\b[\s.!]*$/i;
const REMOVE_RE = /\b(undo|delete|remove|archive|erase|get rid of)\b/i;

// ---------------------------------------------------------------------------
// Sending, with the house style
// ---------------------------------------------------------------------------
async function send(thread, email, { to, cc = [], subject, text, firstName, toJosef = false, inReplyTo, references }) {
  const cfg = agentConfig();
  const body = toJosef ? composeForJosef(text) : compose({ firstName, body: text });
  const ccList = [...new Set((cc || []).filter((e) => e && e !== cfg.address && !to.includes(e)))];
  const r = await sendMail({ to, cc: ccList, subject: subject || reSubject(email.subject), text: body, inReplyTo: inReplyTo ?? email.messageId, references: references ?? email.references });
  if (thread) thread.sent = [...(thread.sent || []), { at: now(), to, cc: ccList, messageId: r.messageId, resendId: r.id, text: String(text).slice(0, 2000) }];
  return r;
}

const replyToJosef = (thread, email, text) => send(thread, email, { to: [email.from.email], text, toJosef: true });
/** Notes go to Josef's primary address only (memory notes, holds, errors, forwards). */
const noteToJosef = (subject, text) => sendMail({ to: [agentConfig().josefAddresses[0]], subject, text: composeForJosef(text) });

/** Everyone else on the original email plus Josef: he is CC'd on every reply not addressed only to him. */
function ccForAsker(email) {
  const cfg = agentConfig();
  return [...otherParticipants(email).filter((e) => e !== email.from.email), ...cfg.josefAddresses.slice(0, 1)];
}

/** The agent is one recipient among several (CC, BCC, or a shared To line). */
function groupMail(email) {
  const me = agentConfig().address;
  const inTo = email.to.some((a) => a.email === me);
  const others = [...email.to, ...email.cc].filter((a) => a.email !== me);
  return !inTo || others.length > 0;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
export async function handleEmail(email) {
  const cfg = agentConfig();
  const log = { from: email.from.email, subject: email.subject };

  if (email.from.email === cfg.address) return { ...log, outcome: "ignored: sent by the agent itself" };
  const automated = isAutomatedMail(email);
  if (automated) return { ...log, outcome: `ignored: ${automated}` };

  const sender = await timed("classify sender", () => classifySender(email));
  log.sender = sender.kind;
  const thread = await timed("load thread", () => loadThread(email));
  thread.lastFrom = email.from.email;
  thread.lastAt = now();
  thread.senderKind = sender.kind;

  let outcome;
  try {
    if (thread.mode === "forward-reply" && sender.kind !== "josef") {
      // The person Josef had the agent write to has replied: Josef gets it, they get nothing.
      const { summary } = await summarizeEmail(email);
      await noteToJosef(`Re: ${thread.subject || email.subject}`, `${email.from.name || email.from.email} replied to the email I sent on your behalf.\n\nIn short: ${summary}\n\nTheir message:\n${(email.text || email.fullText).slice(0, 3000)}\n\nI have not replied to them; this one is yours.`);
      outcome = "forward-reply thread: passed to Josef, no reply sent";
    } else if (groupMail(email)) {
      if (sender.kind !== "josef") {
        thread.mode = thread.mode || "context";
        outcome = "stored as context (group email from someone else)";
      } else {
        outcome = await memoryOnly(email, "group email");
      }
    } else if (sender.kind !== "josef" && !pendingOf(thread) && repliesInLastHour(thread) >= MAX_REPLIES_PER_THREAD_PER_HOUR) {
      // Josef is never capped, and nothing inside an in-progress flow is dropped. Others are held, never silently.
      await noteToJosef(`[EIB agent] held: ${email.subject}`, `I held a message from ${email.from.email} (${email.subject}) because of the rate limit (${MAX_REPLIES_PER_THREAD_PER_HOUR} replies in one thread within an hour). Their message:\n\n${(email.text || email.fullText).slice(0, 2000)}`);
      outcome = "rate cap: held, Josef notified";
    } else if (sender.kind === "josef") {
      outcome = await handleJosef(email, thread);
    } else if (sender.kind === "tfs") {
      outcome = await handleStaff(email, thread, sender);
    } else {
      outcome = await handleUnknown(email, thread, sender);
    }
  } catch (e) {
    outcome = `error: ${e.message}`;
    try {
      await noteToJosef(`[EIB agent error] ${email.subject}`, `I could not finish handling an email from ${email.from.email} (${sender.kind}).\n\nStep: ${e.step || "unknown"}\nError: ${e.message}\n\nThe email:\n${(email.text || email.fullText).slice(0, 2000)}`);
    } catch (e2) {
      console.error(`[eib agent] could not send the error email either: ${e2?.message || e2}`);
    }
    throw e;
  } finally {
    thread.lastOutcome = outcome;
    await saveThread(thread);
  }
  return { ...log, outcome };
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------
/** The memory pass on an email Josef wrote. Returns a one-line description of changes, or "". */
async function runMemoryPass(email, { notify }) {
  const items = (await listMemory()).filter((m) => !isArchived(m));
  const r = await memoryPass({ email, memoryItems: items });
  const lines = [];
  for (const ch of r.changes || []) {
    if (ch.action === "forget") {
      const gone = await forgetMemory(ch.match_topic || ch.topic);
      if (gone) lines.push(`${gone.topic} forgotten`);
      continue;
    }
    const { item, created } = await upsertMemory({ topic: ch.topic, status: ch.status, summary: ch.summary, source: "email", sourceEmailId: email.id, matchTopic: ch.action === "update" ? ch.match_topic : "" });
    lines.push(`${item.topic} -> ${item.status}${created ? " (new)" : ""}`);
  }
  if (r.unsure_question) await noteToJosef(`Memory question: ${email.subject}`, `${r.unsure_question}\n\nReply with "remember: ..." or "forget: ..." to settle it.`);
  if (!lines.length) return "";
  const what = lines.join("; ");
  if (notify) await noteToJosef(`Memory updated: ${email.subject}`, `Memory updated: ${what} (from your email to ${email.to.map((a) => a.email).filter((e) => e !== agentConfig().address).join(", ") || "me"}).\n\nYou can review it at ${MEMORY_URL}.`);
  return what;
}

async function memoryOnly(email, why) {
  const what = await runMemoryPass(email, { notify: true });
  return what ? `${why}: memory updated (${what})` : `${why}: nothing to remember, no reply`;
}

/** "remember:", "forget:", "what do you remember". Returns an outcome string or null when not a memory command. */
async function memoryCommand(email, thread) {
  const text = String(email.text || "").trim();
  const remember = /^remember\s*:\s*([\s\S]+)/i.exec(text);
  if (remember) {
    const note = await rememberNote(remember[1].trim());
    const { item, created, before } = await upsertMemory({ topic: note.topic, status: note.status, summary: note.summary, source: "email", sourceEmailId: email.id });
    await replyToJosef(thread, email, created ? `Got it. I will remember this:\n\n${item.topic} (${item.status}): ${item.summary}` : `Got it. I updated what I had on ${before.topic}:\n\n${item.topic} (${item.status}): ${item.summary}\n\nBefore, it said: ${before.summary}`);
    return `remember: ${item.topic}`;
  }
  const forget = /^forget\s*:\s*([\s\S]+)/i.exec(text);
  if (forget) {
    const gone = await forgetMemory(forget[1].trim());
    await replyToJosef(thread, email, gone ? `Done. I have forgotten ${gone.topic}.` : `I could not find anything matching "${forget[1].trim()}" to forget. You can see everything I remember at ${MEMORY_URL}.`);
    return gone ? `forget: ${gone.topic}` : "forget: nothing matched";
  }
  const what = /what do you (remember|know)(?:\s+about\s+(.+?))?\s*\??$/i.exec(text);
  if (what) {
    const items = what[2] ? await searchMemory(what[2]) : (await listMemory()).filter((m) => !isArchived(m));
    await replyToJosef(thread, email, items.length ? `Here is what I have${what[2] ? ` on ${what[2].trim()}` : ""}:\n\n${describeMemory(items)}\n\nYou can edit any of it at ${MEMORY_URL}.` : `I have nothing on that yet. Tell me with "remember: ..." and I will keep it.`);
    return "memory listed";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unknown senders: one short reply, forward to Josef, nothing from the data.
// ---------------------------------------------------------------------------
async function handleUnknown(email, thread, sender) {
  const cfg = agentConfig();
  thread.mode = "forwarded";
  await send(thread, email, { to: [email.from.email], cc: cfg.josefAddresses.slice(0, 1), firstName: firstNameOf(email.from), text: "Thanks for your email. I have passed it along to Josef, who will get back to you." });
  await sendMail({
    to: cfg.josefAddresses,
    subject: `[EIB fwd${sender.lookalike ? ", suspicious" : ""}] ${email.subject}`,
    text: composeForJosef(`${sender.lookalike ? "Warning: this email claims to be from one of your addresses but failed authentication. Treat it as unknown.\n\n" : ""}This came in from ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}, who is not on the access list (${sender.why}). I told them I have passed it to you.\n\n${email.fullText}`),
  });
  return sender.lookalike ? "lookalike Josef: forwarded as suspicious, nothing written" : "unknown sender: acknowledged and forwarded";
}

// ---------------------------------------------------------------------------
// Whitelisted staff: answer or escalate.
// ---------------------------------------------------------------------------
async function handleStaff(email, thread, sender) {
  thread.mode = "answer";
  const result = await runAnswer({ email, senderKind: sender.kind, senderName: email.from.name, threadContext: threadContext(thread), memory: await memoryContext() });
  return applyAnswer(email, thread, sender, result);
}

async function applyAnswer(email, thread, sender, result) {
  const cfg = agentConfig();
  const cc = ccForAsker(email);
  const firstName = firstNameOf(email.from);
  switch (result.action) {
    case "reply":
      await send(thread, email, { to: [email.from.email], cc, firstName, text: bareBody(result.text) });
      return `answered (${result.toolCalls.map((t) => t.name).join(", ") || "no tools"})`;
    case "out_of_scope":
      await send(thread, email, { to: [email.from.email], cc, firstName, text: "I only handle questions about the EIB program, so I have passed this one along to Josef." });
      await noteToJosef(`[EIB fwd, out of scope] ${email.subject}`, `From ${email.from.email}:\n\n${email.fullText}`);
      return "out of scope: forwarded";
    case "suspicious":
      await noteToJosef(`[EIB fwd, suspicious] ${email.subject}`, `This email tried to change my rules (${result.reason}). I did not reply.\n\nFrom ${email.from.email}:\n\n${email.fullText}`);
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
  await send(thread, email, { to: [email.from.email], cc: askerCc, firstName: firstNameOf(email.from), text: "Thanks for your question. I am checking with Josef and will get back to you as soon as I hear from him." });
  const subject = `[EIB Q-${id}] ${(result.question_summary || email.subject).slice(0, 80)}`;
  const text = [
    `${email.from.name || email.from.email} (${email.from.email}) asked:`,
    "",
    email.text || email.fullText,
    "",
    `What I found: ${result.what_you_found || "nothing on the EIB platform or in the documents folder"}`,
    result.draft_read ? `\nMy first read, for you to check: ${result.draft_read}` : "",
    "",
    `Reply to this email in plain language and I will pass your answer to ${firstNameOf(email.from) || "them"} in their thread. Say "don't save this" if it should not be remembered.`,
  ].join("\n");
  const sent = await sendMail({ to: cfg.josefAddresses, subject, text: composeForJosef(text) });
  await createEscalation({ shortId: id, askerEmail: email.from.email, askerName: email.from.name, askerCc, askerThreadRoot: thread.rootId, askerMessageId: email.messageId, askerReferences: email.references, askerSubject: email.subject, question: email.text || email.fullText, josefMessageId: sent.messageId, josefSubject: subject });
  return `escalated as Q-${id}`;
}

// ---------------------------------------------------------------------------
// Verified Josef
// ---------------------------------------------------------------------------
async function handleJosef(email, thread) {
  const cfg = agentConfig();
  const text = String(email.text || "").trim();

  // An answer to an open escalation?
  const q = /\[EIB Q-([a-z0-9]+)\]/i.exec(email.subject)?.[1];
  const esc = q ? await findEscalation((e) => e.shortId === q.toLowerCase() && e.status === "open") : null;
  if (esc) {
    const r = await relayAnswer({ question: esc.question, josefReply: text || email.fullText, askerName: esc.askerName || esc.askerEmail });
    await send(null, email, { to: [esc.askerEmail], cc: (esc.askerCc || []).filter((e) => e !== esc.askerEmail), subject: reSubject(esc.askerSubject), firstName: firstNameOf({ name: esc.askerName }), text: bareBody(r.answer), inReplyTo: esc.askerMessageId, references: esc.askerReferences || [] });
    const askerThread = await getThread(esc.askerThreadRoot);
    if (askerThread) {
      askerThread.sent = [...(askerThread.sent || []), { at: now(), to: [esc.askerEmail], text: r.answer.slice(0, 2000) }];
      askerThread.mode = "answered";
      await saveThread(askerThread);
    }
    const dontSave = /don'?t save|do not save|ne pas (enregistrer|sauvegarder)/i.test(text);
    const saved = r.save_to_memory && !dontSave;
    if (saved) await upsertMemory({ topic: r.topic || esc.question.slice(0, 40), status: "info", summary: r.answer, source: "email", sourceEmailId: email.id });
    await updateEscalation(esc.id, { status: "answered", answeredAt: now(), answer: r.answer, savedToMemory: saved });
    thread.mode = "escalation-answer";
    return `relayed Josef's answer for Q-${q}${saved ? " and remembered it" : ""}`;
  }

  // A pending step comes first. A YES that lost its thread but quotes "I need your OK on this one" is matched
  // to Josef's most recent forward draft.
  let pending = pendingOf(thread);
  if (!pending && YES_RE.test(firstLineOf(text)) && /I need your OK on this one/i.test(email.fullText || "")) {
    const candidates = (await listThreads((t) => t.draft && t.draft.kind === "forward" && (t.participants || []).includes(email.from.email))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (candidates[0]) {
      const other = candidates[0];
      thread.draft = other.draft;
      other.draft = null;
      await saveThread(other);
      pending = pendingOf(thread);
      console.log(`[eib agent] YES matched to forward draft from thread ${other.rootId} by quoted body`);
    }
  }
  // A forward with an instruction? (Only the unquoted text is read, so a reply under a draft is never a forward.)
  const fwd = pending?.kind === "forward" ? null : parseForward(email);
  if (fwd) return handleForward(email, thread, fwd);

  // Explicit memory commands.
  const mem = await memoryCommand(email, thread);
  if (mem) return mem;

  // Undo, delete, remove: not by email.
  if (!pending && REMOVE_RE.test(text) && /\b(mentor|lesson|record|change|him|her|them|entry|event)\b/i.test(text) && !/\baccess\b/i.test(text)) {
    await replyToJosef(thread, email, `I only add and update records; removing or undoing is done by hand in the Mentor CRM so nothing disappears by accident. You can do that here: ${CRM_URL}\n\nIf you meant a change instead, tell me what to update and I will prepare it for your YES.`);
    return "remove/undo request: pointed to the CRM";
  }

  // A pending step is answered before any fresh intent detection. Yes and no are read from the first
  // non-empty line of Josef's own words, never from anything quoted below.
  const firstLine = firstLineOf(text);
  let intent;
  if (pending && pending.kind === "forward") {
    console.log(`[eib agent] pending forward draft to ${pending.targetName}; reply: ${firstLine.slice(0, 40)}`);
    if (YES_RE.test(firstLine)) intent = { intent: "confirm", edit: EMPTY_EDIT };
    else if (NO_RE.test(firstLine)) intent = { intent: "cancel", edit: EMPTY_EDIT };
    else {
      // Changes to the draft: write it again with his notes.
      const outcome = await handleForward(email, thread, pending.fields.forward, text);
      return outcome;
    }
  } else if (pending && pending.awaiting === "confirm" && YES_RE.test(firstLine)) intent = { intent: "confirm", edit: EMPTY_EDIT };
  else if (pending && NO_RE.test(firstLine)) intent = { intent: "cancel", edit: EMPTY_EDIT };
  else intent = await classifyJosefIntent({ email, pendingDraft: pending });
  if (pending && pending.awaiting === "details" && pending.kind !== "forward" && (intent.intent === "other" || intent.intent === "question" || intent.intent === "confirm")) {
    intent = { ...intent, intent: "edit", edit: { ...intent.edit, action: "update_draft", target_kind: pending.kind, target_name: pending.targetName } };
  }
  console.log(`[eib agent] josef intent ${intent.intent}${pending ? ` (pending ${pending.kind} ${pending.action}, awaiting ${pending.awaiting})` : ""}`);

  let outcome;
  if (intent.intent === "confirm") {
    if (!pending) {
      await replyToJosef(thread, email, "There is nothing waiting for a yes in this thread. If you meant something else, just tell me.");
      outcome = "confirm with no draft";
    } else if (pending.awaiting === "details") {
      await replyToJosef(thread, email, `I still need the ${pending.missing.join(", ")} before I can save. ${pending.kind === "mentor" ? "Reply with the email address at least." : ""}`.trim());
      outcome = "confirm while details missing";
    } else {
      try {
        let done;
        if (pending.kind === "forward") done = await sendForwardReply(thread, pending.fields.forward, pending.fields.draft);
        else if (pending.kind === "access") done = (pending.action === "grant" ? await grantAccess(pending.targetId, { name: pending.fields.name, addedBy: email.from.email }) : await revokeAccess(pending.targetId)).message;
        else done = await commitDraft(pending, email.messageId);
        thread.draft = null;
        await replyToJosef(thread, email, done);
        outcome = `wrote: ${done}`;
      } catch (e) {
        await replyToJosef(thread, email, `I could not save that: ${e.message}\n\nThe draft is still here; tell me what to change, or reply "cancel".`);
        outcome = `write failed: ${e.message}`;
      }
    }
  } else if (intent.intent === "cancel") {
    thread.draft = null;
    thread.mode = "edit-cancelled";
    await replyToJosef(thread, email, "Dropped. Nothing was changed.");
    outcome = "draft cancelled";
  } else if (intent.intent === "access_list") {
    await replyToJosef(thread, email, await describeAccess());
    outcome = "access list sent";
  } else if (intent.intent === "access_add" || intent.intent === "access_remove") {
    const target = String(intent.edit.target_name || "").trim();
    if (!target) {
      await replyToJosef(thread, email, "Who should that be? Give me an email address or a domain.");
      outcome = "access: no target";
    } else {
      setPending(thread, { kind: "access", action: intent.intent === "access_add" ? "grant" : "revoke", targetId: target, targetName: target, fields: { name: intent.edit.fields?.name || "" }, missing: [], createdAt: now() }, "confirm");
      await replyToJosef(thread, email, intent.intent === "access_add" ? `Shall I give ${target} access to ask me questions${target.includes("@") ? "" : " (everyone at that domain)"}? Reply YES to confirm.` : `Shall I remove ${target}'s access? Reply YES to confirm.`);
      outcome = `access ${intent.intent === "access_add" ? "grant" : "revoke"} proposed, awaiting YES`;
    }
  } else if (intent.intent === "edit") {
    const sameTarget = !intent.edit.target_name || intent.edit.target_name.toLowerCase() === String(pending?.targetName || "").toLowerCase() || String(pending?.targetName || "").toLowerCase().includes(intent.edit.target_name.toLowerCase());
    const existing = pending && pending.kind !== "access" && pending.kind !== "forward" && (intent.edit.action === "update_draft" || sameTarget) ? pending : null;
    if (!existing && !intent.edit.target_name && !intent.edit.fields?.name) {
      await replyToJosef(thread, email, "Which mentor or lesson do you mean? Give me the name, for example: add a mentor, Sarah Chen.");
      outcome = "edit: no target";
    } else {
      const r = await buildDraft({ edit: intent.edit, existingDraft: existing });
      if (r.status === "not_found" || r.status === "ambiguous") {
        await replyToJosef(thread, email, r.message);
        outcome = `edit: ${r.status}`;
      } else {
        setPending(thread, r.draft, r.status === "ready" ? "confirm" : "details");
        await replyToJosef(thread, email, r.message);
        outcome = r.status === "ready" ? "edit drafted, awaiting YES" : `edit: asked for ${r.draft.missing.join(", ")}`;
      }
    }
  } else if (intent.intent === "other" && pending && pending.kind !== "access" && pending.kind !== "forward") {
    const r = await buildDraft({ edit: { ...intent.edit, action: "update_draft" }, existingDraft: pending });
    setPending(thread, r.draft, r.status === "ready" ? "confirm" : "details");
    await replyToJosef(thread, email, r.status === "ready" ? await confirmMessage(r.draft) : r.message);
    outcome = "draft corrected";
  } else {
    thread.mode = "answer";
    const result = await runAnswer({ email, senderKind: "josef", senderName: cfg.josefName, threadContext: threadContext(thread), memory: await memoryContext() });
    if (result.action === "reply") {
      await replyToJosef(thread, email, bareBody(result.text));
      outcome = "josef question answered";
    } else if (result.action === "escalate") {
      await replyToJosef(thread, email, `I could not answer that from the EIB platform or the documents folder. ${result.what_you_found || ""}`.trim());
      outcome = "josef question: no answer in data";
    } else {
      await replyToJosef(thread, email, "I only handle questions and changes about the EIB program.");
      outcome = `josef: ${result.action}`;
    }
  }

  // Memory pass only when Josef stated something rather than asked for an action: edits, questions, access
  // changes, and yes/no never create memory by themselves.
  if (intent.intent === "other" && !pending) {
    const what = await runMemoryPass(email, { notify: true }).catch((e) => {
      console.error(`[eib agent] memory pass: ${e.message}`);
      return "";
    });
    if (what) outcome += `; memory: ${what}`;
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// Forward + "handle this"
// ---------------------------------------------------------------------------
async function handleForward(email, thread, fwd, changes = "") {
  const cfg = agentConfig();
  if (!fwd.original.from.email) {
    await replyToJosef(thread, email, "I could not read who the original email was from, so I did not send anything. Could you forward it again as a plain forward?");
    return "forward: original sender unreadable";
  }
  if (fwd.original.from.email === cfg.address) {
    await replyToJosef(thread, email, "That forward is one of my own emails, so there is nobody to reply to. Tell me what you would like done instead.");
    return "forward: nobody to reply to";
  }
  const r = await runForward({ instruction: fwd.instruction, original: fwd.original, memory: await memoryContext(), extra: changes });
  if (r.action === "send_reply") {
    const done = await sendForwardReply(thread, fwd, bareBody(r.text));
    thread.draft = null;
    await replyToJosef(thread, email, done);
    return `forward: replied to ${fwd.original.from.email}`;
  }
  setPending(thread, { kind: "forward", action: "send", targetId: fwd.original.from.email, targetName: fwd.original.from.email, fields: { forward: fwd, draft: bareBody(r.draft) }, missing: [], createdAt: now() }, "confirm");
  const first = firstNameOf(fwd.original.from) || "there";
  await replyToJosef(thread, email, `I need your OK on this one: ${r.reason}\n\nDraft to ${fwd.original.from.name || fwd.original.from.email}:\n\nHi ${first},\n\n${bareBody(r.draft) || "(nothing drafted yet; tell me what to say)"}\n\nReply YES to send, or reply with changes and I will redraft.`);
  return "forward: draft sent to Josef for OK";
}

/** Send the reply to the original sender (Josef in CC) and open a thread that routes their replies to Josef. */
async function sendForwardReply(thread, fwd, text) {
  const cfg = agentConfig();
  const to = fwd.original.from.email;
  const subject = reSubject(fwd.original.subject);
  const r = await sendMail({ to: [to], cc: cfg.josefAddresses.slice(0, 1), subject, text: compose({ firstName: firstNameOf(fwd.original.from), body: text }) });
  const sentEntry = { at: now(), to: [to], cc: cfg.josefAddresses.slice(0, 1), messageId: r.messageId, resendId: r.id, text: String(text).slice(0, 2000) };
  await saveThread({ rootId: r.messageId, subject, participants: [to, ...cfg.josefAddresses], mode: "forward-reply", messages: [], sent: [sentEntry], draft: null, lastOutcome: "replied on Josef's behalf" });
  thread.sent = [...(thread.sent || []), sentEntry];
  return `Sent to ${fwd.original.from.name || to} (${to}) with you in CC, subject "${subject}". If they reply, I will pass it straight to you.`;
}

export { scrubDashes };
