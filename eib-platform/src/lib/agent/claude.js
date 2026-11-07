// Claude calls: the answer loop with tools, the forward-reply loop, the change planner, and the
// structured-output calls (intent, relaying an answer, summaries). With no ANTHROPIC_API_KEY (the local
// sandbox) a small mock answers instead so scripts/agent-smoke.mjs can run.

import Anthropic from "@anthropic-ai/sdk";
import { agentConfig, MAX_TOOL_ROUNDS } from "./config";
import { answerSystemPrompt, forwardSystemPrompt, planSystemPrompt, josefIntentPrompt, JOSEF_INTENT_SCHEMA, relayPrompt, RELAY_SCHEMA, summaryPrompt, SUMMARY_SCHEMA } from "./prompts";
import { TOOL_DEFINITIONS, TERMINAL_TOOLS, FORWARD_TERMINAL_TOOLS, PLAN_TERMINAL_TOOLS, TERMINAL_NAMES, runTool, resolveReferences } from "./tools";
import { buildDraft, findMentors, findEvents } from "./edits";
import { searchDocuments, readDocument, editableFiles, programYear } from "./drive";

const g = globalThis;
function client() {
  const { anthropicKey } = agentConfig();
  if (!anthropicKey) return null;
  // One retry and a 45-second ceiling: the route has 60 seconds in total, and a stuck request must
  // surface as an error with a step name, never as a silent timeout.
  if (!g.__eibAnthropic) g.__eibAnthropic = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  return g.__eibAnthropic;
}

/** Log how long a step took; rethrow with the step name on failure. */
export async function timed(label, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(`[eib agent] ${label}: ${Date.now() - t} ms`);
    return r;
  } catch (e) {
    console.error(`[eib agent] ${label} FAILED after ${Date.now() - t} ms: ${e?.message || e}`);
    const err = new Error(`${label}: ${e?.message || e}`);
    err.step = label;
    err.cause = e;
    throw err;
  }
}

/**
 * The tool loop. Every tool result names its source; the terminal call's `references` (titles) are resolved
 * against those sources so an email can only cite what the tools actually returned.
 */
async function toolLoop({ label, system, user, terminal, senderKind, onFallback, effort = "medium" }) {
  const cfg = agentConfig();
  const c = client();
  const tools = [...TOOL_DEFINITIONS, ...terminal];
  const messages = [{ role: "user", content: user }];
  const toolCalls = [];
  const sources = [];
  const finish = (out) => {
    let references = resolveReferences(out.references, sources);
    if (!references.length && out.action === "need_details") references = resolveReferences(sources.map((s) => s.title), sources);
    return { ...out, references, toolCalls };
  };
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await timed(`${label} round ${round + 1}`, () => c.messages.create({ model: cfg.model, max_tokens: 8000, system, messages, tools, output_config: { effort } }));
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason === "refusal") return finish(onFallback("The model declined to process this email.", toolCalls));
    if (!uses.length) {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return finish(text ? { action: terminal[0].name, text } : onFallback("No answer was produced.", toolCalls));
    }
    const t = uses.find((u) => TERMINAL_NAMES.has(u.name));
    if (t) return finish({ action: t.name, ...(t.input || {}) });
    messages.push({ role: "assistant", content: res.content });
    const results = [];
    for (const u of uses) {
      let result;
      try {
        const r = await timed(`tool ${u.name}`, () => runTool(u.name, u.input || {}, senderKind));
        result = r.result;
        sources.push(...r.sources);
      } catch (e) {
        result = { error: String(e?.message || e) };
      }
      toolCalls.push({ name: u.name, input: u.input, ok: !result?.error });
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
  }
  return finish(onFallback("Too many lookups without a conclusion.", toolCalls));
}

/** Answer mode. Returns { action: "reply" | "escalate" | "out_of_scope" | "suspicious", ...tool input, references, toolCalls }. */
const quotedBlock = (email) => (email?.quoted ? `<quoted_earlier_messages note="the part of the email under 'On ... wrote:', oldest at the bottom">\n${email.quoted}\n</quoted_earlier_messages>` : "");

export async function runAnswer({ email, senderKind, senderName, threadContext, notes }) {
  const cfg = agentConfig();
  const user = [threadContext ? `<thread_so_far>\n${threadContext}\n</thread_so_far>` : "", `<email from="${email.from.name || email.from.email}" subject="${email.subject}">\n${email.text || email.fullText}\n</email>`, quotedBlock(email)].filter(Boolean).join("\n\n");
  if (!client()) return mockAnswer(email, senderKind);
  return toolLoop({
    label: "claude answer",
    system: answerSystemPrompt({ josefName: cfg.josefName, senderKind, senderName, notes, programYear: await programYear().catch(() => "") }),
    user,
    terminal: TERMINAL_TOOLS,
    senderKind,
    onFallback: (why) => ({ action: "escalate", question_summary: email.subject, what_you_found: why, draft_read: "", references: [] }),
  });
}

/** Forward mode. Returns { action: "send_reply" | "needs_ok", text | reason+draft, references, toolCalls }. */
export async function runForward({ instruction, original, notes, extra = "" }) {
  const cfg = agentConfig();
  const user = [
    `<josef_instruction>\n${instruction || "(no instruction: handle this)"}\n</josef_instruction>`,
    extra ? `<josef_changes>\n${extra}\n</josef_changes>` : "",
    `<original_email from="${original.from.name || original.from.email}" email="${original.from.email}" subject="${original.subject}">\n${original.body}\n</original_email>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!client()) return mockForward({ instruction: `${instruction}\n${extra}`, original });
  return toolLoop({
    label: "claude forward",
    system: forwardSystemPrompt({ josefName: cfg.josefName, notes }),
    user,
    terminal: FORWARD_TERMINAL_TOOLS,
    senderKind: "josef",
    onFallback: (why) => ({ action: "needs_ok", reason: why, draft: "", references: [] }),
  });
}

/**
 * Plan mode: turn a change request into concrete steps for a ticket.
 * Returns { action: "propose_changes" | "need_details" | "cannot_plan", summary, steps, notes | question | reason, toolCalls }.
 */
export async function runPlan({ request, senderKind, senderName, threadContext, notes, email }) {
  const cfg = agentConfig();
  const editable = (await editableFiles().catch(() => [])).map((f) => f.name);
  const user = [threadContext ? `<thread_so_far>\n${threadContext}\n</thread_so_far>` : "", `<request from="${senderName || "the sender"}">\n${request}\n</request>`, quotedBlock(email)].filter(Boolean).join("\n\n");
  if (!client()) return mockPlan({ request });
  return toolLoop({
    label: "claude plan",
    system: planSystemPrompt({ josefName: cfg.josefName, senderName, senderKind, notes, editable, programYear: await programYear().catch(() => "") }),
    user,
    terminal: PLAN_TERMINAL_TOOLS,
    senderKind,
    effort: "high",
    onFallback: (why) => ({ action: "cannot_plan", reason: why, references: [] }),
  });
}

async function structured({ system, user, schema, mock, label = "claude structured" }) {
  const cfg = agentConfig();
  const c = client();
  if (!c) return mock();
  const res = await timed(label, () =>
    c.messages.create({ model: cfg.model, max_tokens: 4000, system, messages: [{ role: "user", content: user }], output_config: { effort: "low", format: { type: "json_schema", schema } } }),
  );
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

/** What does the sender want? */
export async function classifyJosefIntent({ email, pendingDraft }) {
  const cfg = agentConfig();
  const user = [
    pendingDraft ? `<pending_edit>\nThe assistant is waiting on this ${pendingDraft.kind} ${pendingDraft.action || ""}: ${JSON.stringify(pendingDraft.fields || pendingDraft.request || "")}. Still missing: ${(pendingDraft.missing || []).join(", ") || "nothing; awaiting YES"}.\n</pending_edit>` : "",
    `<email subject="${email.subject}">\n${email.text || email.fullText}\n</email>`,
    quotedBlock(email),
  ]
    .filter(Boolean)
    .join("\n\n");
  return structured({ system: josefIntentPrompt({ josefName: cfg.josefName }), user, schema: JOSEF_INTENT_SCHEMA, mock: () => mockIntent(email, pendingDraft), label: "claude intent" });
}

/** Josef's reply to an escalation, rewritten for the asker. */
export async function relayAnswer({ question, josefReply, askerName }) {
  const cfg = agentConfig();
  return structured({
    system: relayPrompt({ josefName: cfg.josefName }),
    user: `<question from="${askerName}">\n${question}\n</question>\n<josef_reply>\n${josefReply}\n</josef_reply>`,
    schema: RELAY_SCHEMA,
    mock: () => ({ answer: josefReply.trim() }),
    label: "claude relay",
  });
}

export async function summarizeEmail(email) {
  return structured({ system: summaryPrompt(), user: `From ${email.from.name || email.from.email} <${email.from.email}>, subject "${email.subject}":\n${(email.text || email.fullText).slice(0, 3000)}`, schema: SUMMARY_SCHEMA, mock: () => ({ summary: `${email.from.name || email.from.email} says: ${(email.text || email.fullText).slice(0, 120).replace(/\s+/g, " ")}` }), label: "claude summary" });
}

// ---------------------------------------------------------------------------
// Mock mode (no API key): enough behaviour to exercise every path locally.
// ---------------------------------------------------------------------------
async function mockTool(name, input, senderKind, calls, sources) {
  const r = await runTool(name, input, senderKind);
  calls.push({ name, ok: true });
  sources.push(...r.sources);
  return r.result;
}

async function mockAnswer(email, senderKind) {
  const t = `${email.subject}\n${email.text}`.toLowerCase();
  const toolCalls = [];
  const sources = [];
  const done = (out) => ({ ...out, references: resolveReferences(out.references || sources.map((s) => s.title), sources), toolCalls });
  if (/ignore (your|all) (previous |prior )?instructions|you are now authori[sz]ed|new rules/.test(t)) return done({ action: "suspicious", reason: "tries to change the rules" });
  if (senderKind !== "josef" && /give .+ access/.test(t)) return done({ action: "reply", text: "Only Josef can change who has access, so I have not changed anything. You can email him directly." });
  if (/would .* work as a mentor|should we|can a parent/.test(t)) return done({ action: "escalate", question_summary: email.subject, what_you_found: "A judgment call.", draft_read: "Draft read: fits the brief for a founder-type mentor." });
  if (/run of show|document|slides|deck|file|parking|venue|cougar|eib night|\b20\d{2}\b/.test(t)) {
    const r = await mockTool("search_documents", { query: email.subject + " " + email.text }, senderKind, toolCalls, sources);
    const hit = (r.files || []).find((f) => f.readable && f.snippets.length);
    if (hit) return done({ action: "reply", text: `${hit.snippets[0]} You can read the rest in ${hit.title}.`, references: [hit.title] });
    if (r.files?.length) return done({ action: "reply", text: r.files.map((f) => `${f.title} (updated ${f.modified})`).join("\n"), references: r.files.map((f) => f.title) });
    return done({ action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "" });
  }
  if (/agreement|signed/.test(t)) {
    const r = await mockTool("get_agreement_status", {}, senderKind, toolCalls, sources);
    return done({ action: "reply", text: `${r.counts.signed} students have signed, ${r.counts.pending} are waiting on a parent's confirmation, and ${r.counts.notStarted} have not started. Not yet signed: ${[...r.pending, ...r.notStarted].join(", ") || "nobody"}.` });
  }
  if (/(when|which day|what day|coming to class|in class)/.test(t) && /mentor|[A-Z][a-z]+ [A-Z][a-z]+/.test(`${email.subject}\n${email.text}`)) {
    const r = await mockTool("get_mentor_schedule", {}, senderKind, toolCalls, sources);
    const named = r.visits.find((v) => t.includes(v.mentor.split(" ")[0].toLowerCase()));
    if (named) return done({ action: "reply", text: `${named.mentor} is in for ${named.lesson} on ${named.date}, ${named.time} at ${named.location}.` });
    return done({ action: "reply", text: r.visits.length ? `Mentors are coming on: ${r.visits.map((v) => `${v.date} (${v.mentor}, ${v.lesson})`).join("; ")}.` : "No mentor visits are scheduled yet." });
  }
  if (/mentor/.test(t)) {
    const r = await mockTool("get_mentor_coverage", {}, senderKind, toolCalls, sources);
    const n = r.lessonsWithoutConfirmedMentor.length;
    return done({ action: "reply", text: n ? `As of today, ${n} lesson${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} a confirmed mentor: ${r.lessonsWithoutConfirmedMentor.map((s) => s.lesson).join("; ")}.` : "As of today, every mentor lesson has a confirmed mentor." });
  }
  if (/student|cohort|how many/.test(t)) {
    const r = await mockTool("get_cohort", {}, senderKind, toolCalls, sources);
    return done({ action: "reply", text: `The ${r.cohortYear} cohort has ${r.studentCount} students${r.students ? `: ${r.students.map((s) => s.name).join(", ")}` : ""}.` });
  }
  if (/next week/.test(t)) {
    const r = await mockTool("get_schedule", {}, senderKind, toolCalls, sources);
    return done({ action: "reply", text: r.nextWeek.length ? `Next week: ${r.nextWeek.map((l) => `lesson ${l.number} (${l.title}) on ${l.date}`).join("; ")}.` : "Nothing is scheduled in the next seven days." });
  }
  if (/lesson|when is|where is/.test(t)) {
    const r = await mockTool("get_lessons", {}, senderKind, toolCalls, sources);
    const m = /lesson\s*(\d+)/.exec(t);
    const l = m ? r.rows.find((x) => x.number === m[1]) : null;
    if (l) return done({ action: "reply", text: `Lesson ${l.number}, ${l.title}, is on ${l.date} from ${l.time} in ${l.room}.` });
    return done({ action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "" });
  }
  if (/weather|lunch|joke/.test(t)) return done({ action: "out_of_scope" });
  return done({ action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "" });
}

async function mockForward({ instruction, original }) {
  const i = String(instruction || "").toLowerCase();
  const saying = /reply saying (.+)/i.exec(instruction);
  if (saying) return { action: "send_reply", text: saying[1].trim(), references: [], toolCalls: [] };
  if (/run of show|document|file/.test(i) || /run of show|document|file/.test(original.body.toLowerCase())) {
    const r = await searchDocuments(`${instruction} ${original.subject}`);
    if (r.files?.length) return { action: "send_reply", text: `Here is the document you asked about: ${r.files[0].title}.`, references: [{ title: r.files[0].title, url: r.files[0].link }], toolCalls: ["search_documents"] };
    return { action: "needs_ok", reason: "I could not find that document in the EIB Documents folder.", draft: "Thanks for asking. I will send the document over as soon as it is ready.", references: [], toolCalls: ["search_documents"] };
  }
  const b = original.body.toLowerCase();
  if (/how many students|mentor|lesson/.test(b)) {
    const a = await mockAnswer({ subject: original.subject, text: original.body }, "josef");
    if (a.action === "reply") return { action: "send_reply", text: a.text, references: a.references, toolCalls: a.toolCalls };
  }
  if (/date|when can|pay|invoice|\$|budget|decide|confirm/.test(b)) return { action: "needs_ok", reason: "The reply would commit you to a date or a decision you did not state.", draft: "Thanks for your note. Josef will confirm the details shortly.", references: [], toolCalls: [] };
  return { action: "needs_ok", reason: "I do not have enough information to answer this one.", draft: "Thanks for your email. Josef will get back to you shortly.", references: [], toolCalls: [] };
}

/** The sandbox planner: enough to exercise tickets end to end against the fake folder. */
async function mockPlan({ request }) {
  const text = String(request || "");
  const steps = [];
  const notes = [];
  const done = (out) => ({ ...out, references: [], toolCalls: [] });

  // "EIB Night moves to Nov 24" / "we're moving Cougar's Den to November 24th"
  // The event named in the request, with the last date mentioned (a correction supersedes the first one).
  const named = /(eib night|cougar'?s den)/i.exec(text);
  const dates = [...text.matchAll(/\b(?:to|on|meant|make it|make that)\s+((?:nov(?:ember)?|dec(?:ember)?|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?)\s+\d{1,2})(?:st|nd|rd|th)?/gi)];
  const move = named && dates.length ? [null, named[1], dates[dates.length - 1][1]] : null;
  if (move) {
    const title = move[1].replace(/'?s/i, "'s").replace(/\b\w/g, (c) => c.toUpperCase());
    const newDate = move[2].replace(/\b\w/g, (c) => c.toUpperCase());
    const events = await findEvents(title);
    if (events.length) steps.push({ kind: "platform", description: `Mentor CRM event "${events[0].title}": date becomes ${newDate}`, record: "event", target: events[0].title, action: "update", fields: { date: newDate } });
    else notes.push(`There is no event called ${title} in the Mentor CRM.`);
    const found = await searchDocuments(title);
    for (const f of found.files || []) {
      const doc = await readDocument(f.title);
      if (!doc.text) continue;
      const lines = doc.text.split("\n");
      let table = 0;
      for (const line of lines) {
        const tm = /^\[Table (\d+)\]/.exec(line);
        if (tm) table = Number(tm[1]);
        const rm = /^Row (\d+): (.*)$/.exec(line);
        if (rm && rm[2].toLowerCase().includes(title.toLowerCase())) {
          const cells = rm[2].split(" | ");
          const col = cells.findIndex((c) => /\b(nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct)\w*\s+\d{1,2}\b/i.test(c));
          if (col >= 0) steps.push({ kind: "document", description: `${f.title}: table ${table}, row ${rm[1]}, date column: "${cells[col]}" becomes "${newDate}"`, document: f.title, edit: "table_cell", table, row: Number(rm[1]), column: col + 1, new_text: newDate });
        } else if (!rm && line.toLowerCase().includes(title.toLowerCase())) {
          const dm = /\b((?:nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct)\w*\s+\d{1,2})\b/i.exec(line);
          if (dm && dm[1] !== newDate) steps.push({ kind: "document", description: `${f.title}: "${dm[1]}" becomes "${newDate}" in the sentence about ${title}`, document: f.title, edit: "replace_text", find: dm[1], replace: newDate });
        }
      }
    }
    return done({ action: "propose_changes", summary: `${title} moves to ${newDate}`, steps, notes: notes.join(" ") });
  }

  // "Ray is approved for L4" / "Trent Mell is confirmed for lesson 4"
  const conf = /^(?:ok,?\s*)?([a-z][a-z' -]+?)\s+(?:is|was)?\s*(?:approved|confirmed)\s+for\s+(?:l|lesson\s*)(\d+)/i.exec(text.trim());
  if (conf) {
    const matches = await findMentors(conf[1].trim());
    if (!matches.length) return done({ action: "need_details", question: `I could not find a mentor called ${conf[1].trim()} in the Mentor CRM. What is their full name?` });
    if (matches.length > 1) return done({ action: "need_details", question: `Which one? ${matches.map((m) => m.name).join(", ")}.` });
    const m = matches[0];
    const lesson = conf[2];
    steps.push({ kind: "platform", description: `Mentor CRM: ${m.name} becomes confirmed and is assigned to lesson ${lesson}`, record: "mentor", target: m.name, action: "update", fields: { status: "confirmed", lesson } });
    const found = await searchDocuments("session schedule");
    for (const f of found.files || []) {
      const doc = await readDocument(f.title);
      if (!doc.text) continue;
      let table = 0;
      let header = [];
      for (const line of doc.text.split("\n")) {
        const tm = /^\[Table (\d+)\]/.exec(line);
        if (tm) table = Number(tm[1]);
        const rm = /^Row (\d+): (.*)$/.exec(line);
        if (!rm) continue;
        const cells = rm[2].split(" | ");
        if (rm[1] === "1") header = cells.map((c) => c.toLowerCase());
        if (new RegExp(`^l(esson)?\\s*${lesson}$`, "i").test(cells[0].trim())) {
          const col = header.findIndex((h) => /mentor/.test(h));
          if (col >= 0) steps.push({ kind: "document", description: `${f.title}: row ${cells[0]}, Mentor column: "${cells[col]}" becomes "${m.name} (confirmed)"`, document: f.title, edit: "table_cell", table, row: Number(rm[1]), column: col + 1, new_text: `${m.name} (confirmed)` });
        }
      }
    }
    return done({ action: "propose_changes", summary: `${m.name} confirmed for lesson ${lesson}`, steps, notes: "" });
  }

  // Anything the intent classifier understands as a platform edit.
  const intent = mockIntent({ text }, null);
  if (intent.intent === "edit" && intent.edit.target_kind) {
    const r = await buildDraft({ edit: intent.edit, existingDraft: null });
    if (r.status === "need_fields") return done({ action: "need_details", question: r.message });
    if (r.status !== "ready") return done({ action: "cannot_plan", reason: r.message });
    const d = r.draft;
    steps.push({ kind: "platform", description: `${d.kind === "applications" ? "Application window" : `${d.kind} ${d.targetName}`}: ${Object.entries(d.fields).map(([k, v]) => `${k} ${v}`).join(", ")}`, record: d.kind, target: intent.edit.target_name || d.targetName, action: d.action, fields: { ...intent.edit.fields, ...d.fields } });
    return done({ action: "propose_changes", summary: `${d.action === "create" ? "Add" : "Update"} ${d.kind} ${d.targetName}`, steps, notes: r.draft.note || "" });
  }
  return done({ action: "cannot_plan", reason: "I could not work out what to change from that request." });
}

function mockIntent(email, pendingDraft) {
  const text = (email.text || "").trim();
  const t = text.toLowerCase();
  const empty = { target_kind: "", target_name: "", action: "", fields: {} };
  if (/^(yes|oui|confirmed|go ahead|do it|looks good|approve)\b/.test(t)) return { intent: "confirm", edit: empty };
  if (/^(no|cancel|never mind|forget it|reject)\b/.test(t)) return { intent: "cancel", edit: empty };
  if (/who (has|can)\b.*(access|email you|use)/i.test(text)) return { intent: "access_list", edit: empty };
  const give = /(?:give|grant|add)\s+(\S+@\S+|[a-z0-9.-]+\.[a-z]{2,})\s+(?:agent\s+)?access/i.exec(text) || /(?:give|grant)\s+(?:agent\s+)?access\s+to\s+(\S+)/i.exec(text);
  if (give) return { intent: "access_add", edit: { ...empty, target_name: give[1].replace(/[.,]$/, "") } };
  const rm = /remove\s+(?:agent\s+)?access\s+(?:from|for)\s+(\S+)/i.exec(text) || /revoke\s+(\S+)/i.exec(text);
  if (rm) return { intent: "access_remove", edit: { ...empty, target_name: rm[1].replace(/[.,]$/, "") } };
  if (/(eib night|cougar'?s den)[^.\n]*\b(moves?|moving|moved)\b|\b(moves?|moving|moved)\b[^.\n]*(eib night|cougar'?s den)/i.test(text) || /\b(approved|confirmed) for (l|lesson\s*)\d+/i.test(text)) return { intent: "edit", edit: { ...empty, target_kind: "event", target_name: "", action: "update" } };
  const fields = {};
  for (const [key, re] of Object.entries({
    email: /email(?::| to| is)?\s*([^\s,]+@[^\s,]+)/i,
    phone: /phone:?\s*([+()\d\s-]{7,})/i,
    linkedin: /linkedin:?\s*(\S+)/i,
    organization: /organi[sz]ation:?\s*([^,\n]+)/i,
    title: /title:?\s*([^,\n]+)/i,
    status: /status:?\s*(contacted|responsive|unresponsive|unsure|confirmed)/i,
    lesson: /lesson:?\s*(\d+)/i,
    notes: /notes?:?\s*([^\n]+)/i,
    publicRole: /(?:public role|student[- ]facing title|role line):?\s*([^\n]+)/i,
    bio: /bio:?\s*([^\n]+)/i,
    preferred: /preferred:?\s*(email|phone|linkedin)/i,
    publicContact: /public(?: contact)?:?\s*(email|phone|linkedin|none)/i,
    date: /date:?\s*(\d{4}-\d{2}-\d{2})/i,
    room: /room:?\s*([^,\n]+)/i,
    mentorBrief: /brief:?\s*([^\n]+)/i,
  })) {
    const m = re.exec(text);
    if (m) fields[key] = m[1].trim();
  }
  if (/applications?\s+(?:open|close|window)/i.test(text) || /\b(opens?|closes?):/i.test(text)) {
    const f = {};
    const o = /opens?:?\s*(\S+)/i.exec(text);
    const c = /closes?:?\s*(\S+)/i.exec(text);
    if (o) f.opensAt = o[1];
    if (c) f.closesAt = c[1];
    return { intent: "edit", edit: { ...empty, target_kind: "applications", target_name: "applications", action: "update", fields: f } };
  }
  const add = /add (?:a )?(?:new )?mentor[,:]?\s*([^,\n.]+)/i.exec(text);
  if (add) return { intent: "edit", edit: { ...empty, target_kind: "mentor", target_name: add[1].trim(), action: "create", fields: { name: add[1].trim(), ...fields } } };
  const upd = /(?:update|change|set|mark)\s+(?:mentor\s+)?([^,\n:]+?)(?:'s)?\s+(?:status|to|as|email|lesson)/i.exec(text);
  if (upd && !/lesson\s*\d+\s*(date|room|brief)/i.test(text)) {
    const statusWord = /\b(contacted|responsive|unresponsive|unsure|confirmed)\b/i.exec(text);
    if (statusWord) fields.status = statusWord[1].toLowerCase();
    return { intent: "edit", edit: { ...empty, target_kind: "mentor", target_name: upd[1].trim(), action: "update", fields } };
  }
  const lesson = /lesson\s*(\d+)/i.exec(text);
  if (lesson && Object.keys(fields).length) return { intent: "edit", edit: { ...empty, target_kind: "lesson", target_name: lesson[1], action: "update", fields } };
  if (pendingDraft && Object.keys(fields).length) return { intent: "edit", edit: { ...empty, target_kind: pendingDraft.kind, target_name: pendingDraft.targetName, action: "update_draft", fields } };
  if (!pendingDraft && /Happy to add|Could you send me the rest|I need (his|her|their) email/i.test(email.quoted || "")) return { intent: "edit", edit: { ...empty, target_kind: "mentor", target_name: "", action: "update_draft", fields } };
  if (/\?/.test(text) || /^(what|when|where|who|how)\b/.test(t)) return { intent: "question", edit: empty };
  return { intent: "other", edit: empty };
}
