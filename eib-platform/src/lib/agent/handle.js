// The orchestrator: one received email in, zero or more emails out. Called by the inbound route after the
// webhook has been verified and deduplicated.
//
// Who sent it decides everything. Verified Josef can ask, request changes, forward with an instruction, and
// approve tickets. Whitelisted TFS staff get answers, or their change requests become tickets for Josef.
// Everyone else gets a one-line acknowledgement and a forward to Josef. When the agent is not the only
// recipient it stays silent. Facts come from the EIB platform and the EIB Documents folder, nothing else.

import { agentConfig, MAX_REPLIES_PER_THREAD_PER_HOUR, THREAD_CONTEXT_MESSAGES, DRAFT_EXPIRY_DAYS } from "./config";
import { isAutomatedMail, reSubject, sendMail, firstLineOf } from "./mail";
import { classifySender, otherParticipants } from "./classify";
import { runAnswer, runForward, runPlan, classifyJosefIntent, relayAnswer, summarizeEmail, timed } from "./claude";
import { parseForward, unquoted } from "./forward";
import { readmeContext } from "./drive";
import { getThread, listThreads, saveThread, createEscalation, findEscalation, updateEscalation } from "./db";
import { describeAccess, grantAccess, revokeAccess } from "./access";
import { createTicket, ticketEmailText, ticketLabel, ticketUrl, ticketReferences, applyTicket, rejectTicket, notifyDecision, getChange, describeSteps } from "./changes";
import { compose, composeForJosef, bareBody, firstNameOf, scrubDashes, CRM_URL } from "./style";

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

/** Both sides of the thread so far (the sender's earlier emails and the assistant's replies), oldest first. */
function threadContext(thread) {
  const inbound = (thread.messages || []).slice(0, -1).map((m) => ({ at: m.at, who: m.name || m.from, text: m.text }));
  const sent = (thread.sent || []).map((s) => ({ at: s.at, who: "EIB Assistant", text: s.text }));
  return [...inbound, ...sent]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .slice(-THREAD_CONTEXT_MESSAGES)
    .map((m) => `[${String(m.at).slice(0, 16)}] ${m.who}: ${m.text}`)
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
  thread.mode = draft.kind === "change" ? "change" : draft.kind === "plan" ? "plan" : "edit";
}

const YES_RE = /^\s*(yes|y|yep|yeah|yup|confirmed?|approved?|go ahead|do it|send( it)?|save( it)?|apply( it)?|looks good|correct|ok(ay)?|oui|d'accord)\b[\s.!]*$/i;
const NO_RE = /^\s*(no|nope|cancel|reject(ed)?|never mind|nevermind|forget it|stop|don'?t|non|annule[rz]?)\b[\s.!]*$/i;
const REMOVE_RE = /\b(undo|delete|remove|archive|erase|get rid of)\b/i;
const CHANGE_VERB = /\b(add|create|update|change|set|assign|move|moving|moved|reschedule|remove|give|grant|revoke|make|mark|edit|rename|open|close|confirm|confirmed|approve|approved|book|cancel)\b/i;

// ---------------------------------------------------------------------------
// Sending, with the house style
// ---------------------------------------------------------------------------
async function send(thread, email, { to, cc = [], subject, text, firstName, toJosef = false, inReplyTo, references, sources = [] }) {
  const cfg = agentConfig();
  const body = toJosef ? composeForJosef(text, sources) : compose({ firstName, body: text, references: sources });
  const ccList = [...new Set((cc || []).filter((e) => e && e !== cfg.address && !to.includes(e)))];
  const r = await sendMail({ to, cc: ccList, subject: subject || reSubject(email.subject), text: body, inReplyTo: inReplyTo ?? email.messageId, references: references ?? email.references });
  if (thread) thread.sent = [...(thread.sent || []), { at: now(), to, cc: ccList, messageId: r.messageId, resendId: r.id, text: String(text).slice(0, 2000) }];
  return r;
}

const replyToJosef = (thread, email, text, sources = [], subject) => send(thread, email, { to: [email.from.email], text, toJosef: true, sources, subject });
/** Notes go to Josef's primary address only (holds, errors, forwards). */
const noteToJosef = (subject, text) => sendMail({ to: [agentConfig().josefAddresses[0]], subject, text: composeForJosef(text) });

/** The first sentence of a summary, on one line. */
function oneSentence(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(?:\s+[A-Z"(]|$)/.exec(t);
  return m ? m[1] : t;
}

/** Text the model wrote for Josef, with any sentence about its own tools or inner workings dropped. */
function plainForJosef(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const kept = t
    .split(/(?<=[.!?])\s+/)
    .filter((sent) => !/\btools?\b|\bfunction\b|\bschema\b|\b(search|get|read)_[a-z_]+\b|\bI (have|had) no (tool|way|function)\b/i.test(sent));
  return kept.join(" ").trim();
}

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

const notesFor = () =>
  readmeContext().catch((e) => {
    console.error(`[eib agent] folder notes: ${e.message}`);
    return "";
  });

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
      const theirs = unquoted(email.text || email.fullText).trim() || (email.text || email.fullText || "").trim();
      const { summary } = await summarizeEmail({ ...email, text: theirs, fullText: theirs });
      await noteToJosef(`Re: ${thread.subject || email.subject}`, `${email.from.name || email.from.email} replied to the email I sent on your behalf.\n\nIn short: ${oneSentence(summary)}\n\nTheir message:\n${theirs.slice(0, 3000)}\n\nI have not replied to them; this one is yours.`);
      outcome = "forward-reply thread: passed to Josef, no reply sent";
    } else if (groupMail(email)) {
      // CC'd, BCC'd, or one of several recipients: the agent listens and says nothing.
      thread.mode = thread.mode || "context";
      outcome = `stored as context (group email${sender.kind === "josef" ? " from Josef" : ""})`;
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
// Unknown senders: one short reply, forward to Josef, nothing from the data.
// ---------------------------------------------------------------------------
async function handleUnknown(email, thread, sender) {
  const cfg = agentConfig();
  thread.mode = "forwarded";
  await send(thread, email, { to: [email.from.email], cc: cfg.josefAddresses.slice(0, 1), firstName: firstNameOf(email.from), text: "Thanks for your email. I have passed it along to Josef, who will get back to you." });
  await sendMail({
    to: cfg.josefAddresses.slice(0, 1),
    subject: `[EIB fwd${sender.lookalike ? ", suspicious" : ""}] ${email.subject}`,
    text: composeForJosef(`${sender.lookalike ? "Warning: this email claims to be from one of your addresses but failed authentication. Treat it as unknown.\n\n" : ""}This came in from ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}, who is not on the access list (${sender.why}). I told them I have passed it to you.\n\n${email.fullText}`),
  });
  return sender.lookalike ? "lookalike Josef: forwarded as suspicious, nothing written" : "unknown sender: acknowledged and forwarded";
}

// ---------------------------------------------------------------------------
// Whitelisted staff: answer, or turn a change request into a ticket for Josef.
// ---------------------------------------------------------------------------
async function handleStaff(email, thread, sender) {
  const text = (email.text || email.fullText || "").trim();
  const pending = pendingOf(thread);
  // Details for a change the assistant asked about earlier in this thread.
  if (pending?.kind === "plan" && pending.requester === email.from.email && !NO_RE.test(firstLineOf(text))) {
    return startPlan(email, thread, sender, `${pending.request}\n\nMore details from ${email.from.name || email.from.email}: ${text}`);
  }
  if (pending?.kind === "plan" && NO_RE.test(firstLineOf(text))) {
    thread.draft = null;
    await send(thread, email, { to: [email.from.email], cc: ccForAsker(email), firstName: firstNameOf(email.from), text: "No problem, I have dropped that. Nothing was changed." });
    return "plan dropped by requester";
  }
  thread.mode = "answer";
  if (CHANGE_VERB.test(text)) {
    const intent = await timed("staff intent", () => classifyJosefIntent({ email, pendingDraft: null }));
    if (intent.intent === "access_add" || intent.intent === "access_remove") {
      await send(thread, email, { to: [email.from.email], cc: ccForAsker(email), firstName: firstNameOf(email.from), text: "Only Josef can change who has access to me, so I have not changed anything. I have let him know you asked, and you can also email him directly." });
      return "refused access request from staff";
    }
    if (intent.intent === "edit") return startPlan(email, thread, sender, text);
  }
  const result = await runAnswer({ email, senderKind: sender.kind, senderName: email.from.name, threadContext: threadContext(thread), notes: await notesFor() });
  return applyAnswer(email, thread, sender, result);
}

async function applyAnswer(email, thread, sender, result) {
  const cc = ccForAsker(email);
  const firstName = firstNameOf(email.from);
  switch (result.action) {
    case "reply":
      await send(thread, email, { to: [email.from.email], cc, firstName, text: bareBody(result.text), sources: result.references });
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

/** The platform and the documents did not answer it: the asker hears it is with Josef, Josef gets the email. */
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
    `What I found: ${plainForJosef(result.what_you_found) || "nothing on the EIB platform or in the documents folder"}`,
    result.draft_read ? `\nMy first read, for you to check: ${plainForJosef(result.draft_read)}` : "",
    "",
    `Reply to this email in plain language and I will pass your answer to ${firstNameOf(email.from) || "them"} in their thread. If this should be the standing answer, add it to the Read me document in the EIB Documents folder.`,
  ].join("\n");
  const sent = await sendMail({ to: cfg.josefAddresses.slice(0, 1), subject, text: composeForJosef(text) });
  await createEscalation({ shortId: id, askerEmail: email.from.email, askerName: email.from.name, askerCc, askerThreadRoot: thread.rootId, askerMessageId: email.messageId, askerReferences: email.references, askerSubject: email.subject, question: email.text || email.fullText, josefMessageId: sent.messageId, josefSubject: subject });
  return `escalated as Q-${id}`;
}

// ---------------------------------------------------------------------------
// Change tickets
// ---------------------------------------------------------------------------
/** Plan a change for the sender (Josef or staff) and open a ticket, ask for details, or hand it to Josef. */
async function startPlan(email, thread, sender, request) {
  const cfg = agentConfig();
  const isJosef = sender.kind === "josef";
  const first = firstNameOf(email.from);
  const r = await runPlan({ request, senderKind: sender.kind, senderName: email.from.name || email.from.email, threadContext: threadContext(thread), notes: await notesFor(), email });
  const replyBack = (text, sources = []) => (isJosef ? replyToJosef(thread, email, text, sources) : send(thread, email, { to: [email.from.email], cc: ccForAsker(email), firstName: first, text, sources }));

  if (r.action === "need_details") {
    setPending(thread, { kind: "plan", request, requester: email.from.email, createdAt: now() }, "details");
    await replyBack(r.question, r.references || []);
    return "plan: asked for details";
  }
  if (r.action !== "propose_changes" || !(r.steps || []).length) {
    thread.draft = null;
    if (isJosef) {
      await replyToJosef(thread, email, `I could not turn that into a change myself: ${plainForJosef(r.reason) || "it is not a record or a document I can edit."} If it lives somewhere I can reach, tell me where and I will try again.`);
      return "plan: nothing to propose (Josef told)";
    }
    await replyBack("Thanks for letting me know. I have passed this to Josef, who will take it from here.");
    await noteToJosef(`[EIB fwd] ${email.subject}`, `${email.from.name || email.from.email} (${email.from.email}) asked for a change I could not prepare myself (${plainForJosef(r.reason) || "not something I can edit"}). I told them it is with you.\n\n${email.fullText}`);
    return "plan: nothing to propose (passed to Josef)";
  }

  const requester = { email: email.from.email, name: email.from.name, kind: sender.kind, messageId: email.messageId, references: email.references, subject: email.subject };
  const { ticket, usable } = await createTicket({ plan: r, requester, threadRootId: thread.rootId });
  thread.draft = null;
  if (!usable) {
    const problems = ticket.steps.map((s) => `- ${s.description}: ${s.problem}`).join("\n");
    if (isJosef) {
      await replyToJosef(thread, email, `I worked out what would need to change, but none of it is something I can do right now:\n\n${problems}\n\nThe ticket is on the website for the record: ${ticketUrl(ticket)}`);
      return `plan: ticket C-${ticket.shortId} has no usable steps (Josef told)`;
    }
    await replyBack("Thanks for letting me know. I have passed this to Josef, who will take it from here.");
    await noteToJosef(`${ticketLabel(ticket)} needs you: ${ticket.summary}`, `${email.from.name || email.from.email} asked: ${ticket.summary}. I could not prepare any of it myself:\n\n${problems}\n\n${ticketUrl(ticket)}`);
    return `plan: ticket C-${ticket.shortId} has no usable steps (passed to Josef)`;
  }

  // The approval email to Josef opens (or continues) a thread whose YES/NO decides the ticket.
  const subject = `${ticketLabel(ticket)} ${ticket.summary}`;
  const text = ticketEmailText(ticket);
  if (isJosef) {
    await replyToJosef(thread, email, text, ticketReferences(ticket), subject);
    setPending(thread, { kind: "change", changeId: ticket.id, createdAt: now() }, "confirm");
  } else {
    const sent = await sendMail({ to: cfg.josefAddresses.slice(0, 1), subject, text: composeForJosef(text, ticketReferences(ticket)) });
    await saveThread({ rootId: sent.messageId, subject, participants: [...cfg.josefAddresses], mode: "change", messages: [], sent: [{ at: now(), to: cfg.josefAddresses.slice(0, 1), messageId: sent.messageId, resendId: sent.id, text: text.slice(0, 2000) }], draft: { kind: "change", changeId: ticket.id, createdAt: now(), awaiting: "confirm", expiresAt: ticket.expiresAt }, lastOutcome: `ticket C-${ticket.shortId} proposed` });
    await replyBack(`Thanks, I have written this up for Josef to approve: ${ticket.summary}.\n\n${describeSteps(ticket)}\n\nI will let you know as soon as he has decided.`, ticketReferences(ticket));
  }
  return `plan: ticket C-${ticket.shortId} proposed (${usable} step${usable === 1 ? "" : "s"}), awaiting approval`;
}

/** Josef decided a ticket by email (YES or NO on its thread). */
async function decideTicketByEmail(email, thread, ticketId, approve) {
  const ticket = await getChange(ticketId);
  if (!ticket) {
    await replyToJosef(thread, email, "I could not find that change ticket any more.");
    return "ticket missing";
  }
  if (ticket.status !== "proposed") {
    await replyToJosef(thread, email, `That ticket is already ${ticket.status}. ${ticketUrl(ticket)}`);
    thread.draft = null;
    return `ticket already ${ticket.status}`;
  }
  const lastSent = (thread.sent || [])[thread.sent.length - 1];
  const updated = approve ? await applyTicket(ticket, { by: email.from.email }) : await rejectTicket(ticket, { by: email.from.email, reason: NO_RE.test(firstLineOf(email.text || "")) ? "" : (email.text || "").trim().slice(0, 300) });
  thread.draft = null;
  thread.mode = "change-decided";
  await notifyDecision(updated, { viaEmail: true, josefThread: lastSent });
  if (updated.requester?.kind === "josef") {
    const lines = (updated.steps || []).map((s) => (s.status === "done" ? `${s.n}. Done: ${s.result}` : s.status === "failed" ? `${s.n}. Failed: ${s.problem}` : `${s.n}. Skipped: ${s.problem || s.description}`)).join("\n");
    await replyToJosef(thread, email, approve ? `${updated.status === "applied" ? "Done" : updated.status === "partly applied" ? "Partly done" : "I could not apply it"}: ${updated.summary}.\n\n${lines}\n\n${ticketUrl(updated)}` : `Rejected, nothing was changed: ${updated.summary}.`);
  }
  return approve ? `ticket C-${updated.shortId} ${updated.status}` : `ticket C-${updated.shortId} rejected`;
}

// ---------------------------------------------------------------------------
// Verified Josef
// ---------------------------------------------------------------------------
async function handleJosef(email, thread) {
  const cfg = agentConfig();
  const text = String(email.text || "").trim();
  const firstLine = firstLineOf(text);

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
    await updateEscalation(esc.id, { status: "answered", answeredAt: now(), answer: r.answer });
    thread.mode = "escalation-answer";
    return `relayed Josef's answer for Q-${q}`;
  }

  // A YES or NO on a change ticket: by the pending state of this thread, or by the ticket id in the subject.
  let pending = pendingOf(thread);
  const c = /\[EIB change C-([a-z0-9]+)\]/i.exec(email.subject)?.[1];
  const ticketId = pending?.kind === "change" ? pending.changeId : c ? (await getChange(c.toLowerCase()))?.id : null;
  if (ticketId && (YES_RE.test(firstLine) || NO_RE.test(firstLine))) return decideTicketByEmail(email, thread, ticketId, YES_RE.test(firstLine));
  if (ticketId && pending?.kind === "change") {
    // Anything else on a ticket thread is a change of mind: plan again with his notes.
    const ticket = await getChange(ticketId);
    if (ticket?.status === "proposed") {
      await rejectTicket(ticket, { by: email.from.email, reason: "replaced by a new ticket" });
      thread.draft = null;
      const original = ticket.requester?.kind === "josef" ? (thread.messages || []).find((m) => m.from === email.from.email)?.text || ticket.summary : ticket.summary;
      return startPlan(email, thread, { kind: "josef" }, `${original}\n\nJosef's changes to the plan: ${text}`);
    }
  }

  // A YES that lost its thread but quotes "I need your OK on this one" is matched to his most recent forward draft.
  if (!pending && YES_RE.test(firstLine) && /I need your OK on this one/i.test(email.fullText || "")) {
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

  // Details for a change the assistant asked about.
  if (pending?.kind === "plan") {
    if (NO_RE.test(firstLine)) {
      thread.draft = null;
      await replyToJosef(thread, email, "Dropped. Nothing was changed.");
      return "plan dropped";
    }
    return startPlan(email, thread, { kind: "josef" }, `${pending.request}\n\nMore details from Josef: ${text}`);
  }

  // Undo, delete, remove: not by email.
  if (!pending && REMOVE_RE.test(text) && /\b(mentor|lesson|record|change|him|her|them|entry|event)\b/i.test(text) && !/\baccess\b/i.test(text)) {
    await replyToJosef(thread, email, `I only add and update records; removing or undoing is done by hand in the Mentor CRM so nothing disappears by accident. You can do that here: ${CRM_URL}\n\nIf you meant a change instead, tell me what to update and I will write it up for your approval.`);
    return "remove/undo request: pointed to the CRM";
  }

  // A pending forward or access step is answered before any fresh intent detection.
  let intent;
  if (pending && pending.kind === "forward") {
    console.log(`[eib agent] pending forward draft to ${pending.targetName}; reply: ${firstLine.slice(0, 40)}`);
    if (YES_RE.test(firstLine)) intent = { intent: "confirm", edit: EMPTY_EDIT };
    else if (NO_RE.test(firstLine)) intent = { intent: "cancel", edit: EMPTY_EDIT };
    else return handleForward(email, thread, pending.fields.forward, text);
  } else if (pending && pending.awaiting === "confirm" && YES_RE.test(firstLine)) intent = { intent: "confirm", edit: EMPTY_EDIT };
  else if (pending && NO_RE.test(firstLine)) intent = { intent: "cancel", edit: EMPTY_EDIT };
  else intent = await classifyJosefIntent({ email, pendingDraft: pending });
  console.log(`[eib agent] josef intent ${intent.intent}${pending ? ` (pending ${pending.kind}, awaiting ${pending.awaiting})` : ""}`);

  if (intent.intent === "confirm") {
    if (!pending) {
      await replyToJosef(thread, email, "There is nothing waiting for a yes in this thread. If you meant something else, just tell me.");
      return "confirm with no draft";
    }
    try {
      let done;
      if (pending.kind === "forward") done = await sendForwardReply(thread, pending.fields.forward, pending.fields.draft, pending.fields.references || []);
      else if (pending.kind === "access") done = (pending.action === "grant" ? await grantAccess(pending.targetId, { name: pending.fields.name, addedBy: email.from.email }) : await revokeAccess(pending.targetId)).message;
      else done = "There is nothing waiting for a yes in this thread.";
      thread.draft = null;
      await replyToJosef(thread, email, done);
      return `wrote: ${done}`;
    } catch (e) {
      await replyToJosef(thread, email, `I could not do that: ${e.message}\n\nTell me what to change, or reply "cancel".`);
      return `write failed: ${e.message}`;
    }
  }
  if (intent.intent === "cancel") {
    thread.draft = null;
    thread.mode = "edit-cancelled";
    await replyToJosef(thread, email, "Dropped. Nothing was changed.");
    return "draft cancelled";
  }
  if (intent.intent === "access_list") {
    await replyToJosef(thread, email, await describeAccess());
    return "access list sent";
  }
  if (intent.intent === "access_add" || intent.intent === "access_remove") {
    const target = String(intent.edit.target_name || "").trim();
    if (!target) {
      await replyToJosef(thread, email, "Who should that be? Give me an email address or a domain.");
      return "access: no target";
    }
    if (!target.includes("@")) {
      await replyToJosef(thread, email, intent.intent === "access_add" ? `Access is given per person, never to a whole domain, so I cannot open it to everyone at ${target}. Tell me each person's email address and I will add them one by one.` : (await revokeAccess(target)).message);
      return "access: domain refused";
    }
    setPending(thread, { kind: "access", action: intent.intent === "access_add" ? "grant" : "revoke", targetId: target, targetName: target, fields: { name: intent.edit.fields?.name || "" }, missing: [], createdAt: now() }, "confirm");
    await replyToJosef(thread, email, intent.intent === "access_add" ? `Shall I give ${target} access to ask me questions? Reply YES to confirm.` : `Shall I remove ${target}'s access? Reply YES to confirm.`);
    return `access ${intent.intent === "access_add" ? "grant" : "revoke"} proposed, awaiting YES`;
  }
  // A reply that continues a change the assistant asked about, found only through the quoted chain (the thread
  // itself was not matched): the quoted assistant question plus his reply is the request.
  if (intent.intent === "edit") return startPlan(email, thread, { kind: "josef" }, !pending && intent.edit.action === "update_draft" && email.quoted ? `${email.quoted}\n\nJosef's reply: ${text}` : text);

  // A question, or anything else: answer from the platform and the documents.
  thread.mode = "answer";
  const result = await runAnswer({ email, senderKind: "josef", senderName: cfg.josefName, threadContext: threadContext(thread), notes: await notesFor() });
  if (result.action === "reply") {
    await replyToJosef(thread, email, bareBody(result.text), result.references);
    return "josef question answered";
  }
  if (result.action === "escalate") {
    await replyToJosef(thread, email, `I could not answer that from the EIB platform or the documents folder. ${plainForJosef(result.what_you_found) || ""}`.trim());
    return "josef question: no answer in data";
  }
  await replyToJosef(thread, email, "I only handle questions and changes about the EIB program.");
  return `josef: ${result.action}`;
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
  const r = await runForward({ instruction: fwd.instruction, original: fwd.original, notes: await notesFor(), extra: changes });
  if (r.action === "send_reply") {
    const done = await sendForwardReply(thread, fwd, bareBody(r.text), r.references || []);
    thread.draft = null;
    await replyToJosef(thread, email, done);
    return `forward: replied to ${fwd.original.from.email}`;
  }
  setPending(thread, { kind: "forward", action: "send", targetId: fwd.original.from.email, targetName: fwd.original.from.email, fields: { forward: fwd, draft: bareBody(r.draft), references: r.references || [] }, missing: [], createdAt: now() }, "confirm");
  const first = firstNameOf(fwd.original.from) || "there";
  await replyToJosef(thread, email, `I need your OK on this one: ${r.reason}\n\nDraft to ${fwd.original.from.name || fwd.original.from.email}:\n\nHi ${first},\n\n${bareBody(r.draft) || "(nothing drafted yet; tell me what to say)"}\n\nReply YES to send, or reply with changes and I will redraft.`);
  return "forward: draft sent to Josef for OK";
}

/** Send the reply to the original sender (Josef in CC) and open a thread that routes their replies to Josef. */
async function sendForwardReply(thread, fwd, text, references = []) {
  const cfg = agentConfig();
  const to = fwd.original.from.email;
  const subject = reSubject(fwd.original.subject);
  const r = await sendMail({ to: [to], cc: cfg.josefAddresses.slice(0, 1), subject, text: compose({ firstName: firstNameOf(fwd.original.from), body: text, references }) });
  const sentEntry = { at: now(), to: [to], cc: cfg.josefAddresses.slice(0, 1), messageId: r.messageId, resendId: r.id, text: String(text).slice(0, 2000) };
  await saveThread({ rootId: r.messageId, subject, participants: [to, ...cfg.josefAddresses], mode: "forward-reply", messages: [], sent: [sentEntry], draft: null, lastOutcome: "replied on Josef's behalf" });
  thread.sent = [...(thread.sent || []), sentEntry];
  return `Sent to ${fwd.original.from.name || to} (${to}) with you in CC, subject "${subject}". If they reply, I will pass it straight to you.`;
}

export { scrubDashes };
