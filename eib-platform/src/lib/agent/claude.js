// Claude calls: the answer loop with tools, the forward-reply loop, and the structured-output calls
// (Josef's intent, relaying an answer, the memory pass, remember notes, summaries). With no
// ANTHROPIC_API_KEY (the local sandbox) a small mock answers instead so scripts/agent-smoke.mjs can run.

import Anthropic from "@anthropic-ai/sdk";
import { agentConfig, MAX_TOOL_ROUNDS } from "./config";
import {
  answerSystemPrompt,
  forwardSystemPrompt,
  josefIntentPrompt,
  JOSEF_INTENT_SCHEMA,
  relayPrompt,
  RELAY_SCHEMA,
  memoryPassPrompt,
  MEMORY_PASS_SCHEMA,
  rememberPrompt,
  REMEMBER_SCHEMA,
  summaryPrompt,
  SUMMARY_SCHEMA,
} from "./prompts";
import { TOOL_DEFINITIONS, TERMINAL_TOOLS, FORWARD_TERMINAL_TOOLS, TERMINAL_NAMES, runTool } from "./tools";

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

async function toolLoop({ label, system, user, terminal, senderKind, onFallback }) {
  const cfg = agentConfig();
  const c = client();
  const tools = [...TOOL_DEFINITIONS, ...terminal];
  const messages = [{ role: "user", content: user }];
  const toolCalls = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await timed(`${label} round ${round + 1}`, () => c.messages.create({ model: cfg.model, max_tokens: 8000, system, messages, tools, output_config: { effort: "medium" } }));
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason === "refusal") return onFallback("The model declined to process this email.", toolCalls);
    if (!uses.length) {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return text ? { action: terminal[0].name, text, toolCalls } : onFallback("No answer was produced.", toolCalls);
    }
    const t = uses.find((u) => TERMINAL_NAMES.has(u.name));
    if (t) return { action: t.name, ...t.input, toolCalls };
    messages.push({ role: "assistant", content: res.content });
    const results = [];
    for (const u of uses) {
      let result;
      try {
        result = await timed(`tool ${u.name}`, () => runTool(u.name, u.input || {}, senderKind));
      } catch (e) {
        result = { error: String(e?.message || e) };
      }
      toolCalls.push({ name: u.name, input: u.input, ok: !result?.error });
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
  }
  return onFallback("Too many lookups without a conclusion.", toolCalls);
}

/** Answer mode. Returns { action: "reply" | "escalate" | "out_of_scope" | "suspicious", ...tool input, toolCalls }. */
export async function runAnswer({ email, senderKind, senderName, threadContext, memory }) {
  const cfg = agentConfig();
  const user = [threadContext ? `<thread_so_far>\n${threadContext}\n</thread_so_far>` : "", `<email from="${email.from.name || email.from.email}" subject="${email.subject}">\n${email.text || email.fullText}\n</email>`].filter(Boolean).join("\n\n");
  if (!client()) return mockAnswer(email, senderKind);
  return toolLoop({
    label: "claude answer",
    system: answerSystemPrompt({ josefName: cfg.josefName, senderKind, senderName, memory }),
    user,
    terminal: TERMINAL_TOOLS,
    senderKind,
    onFallback: (why, toolCalls) => ({ action: "escalate", question_summary: email.subject, what_you_found: why, draft_read: "", toolCalls }),
  });
}

/** Forward mode. Returns { action: "send_reply" | "needs_ok", text | reason+draft, toolCalls }. */
export async function runForward({ instruction, original, memory, extra = "" }) {
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
    system: forwardSystemPrompt({ josefName: cfg.josefName, memory }),
    user,
    terminal: FORWARD_TERMINAL_TOOLS,
    senderKind: "josef",
    onFallback: (why, toolCalls) => ({ action: "needs_ok", reason: why, draft: "", toolCalls }),
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

/** What does Josef want? */
export async function classifyJosefIntent({ email, pendingDraft }) {
  const cfg = agentConfig();
  const user = [
    pendingDraft ? `<pending_edit>\nThe assistant is waiting on this ${pendingDraft.kind} ${pendingDraft.action}: ${JSON.stringify(pendingDraft.fields)}. Still missing: ${(pendingDraft.missing || []).join(", ") || "nothing; awaiting YES"}.\n</pending_edit>` : "",
    `<email subject="${email.subject}">\n${email.text || email.fullText}\n</email>`,
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
    mock: () => ({ answer: josefReply.trim(), save_to_memory: !/don'?t save|do not save|one[- ]off/i.test(josefReply), topic: question.slice(0, 40).replace(/[?.]$/, "") }),
    label: "claude relay",
  });
}

/** The memory pass over an email Josef wrote or was copied on. */
export async function memoryPass({ email, memoryItems }) {
  const cfg = agentConfig();
  const current = memoryItems.length ? memoryItems.map((m) => `- ${m.topic} [${m.status}]: ${m.summary}`).join("\n") : "(empty)";
  const user = `<current_memory>\n${current}\n</current_memory>\n<email from="${email.from.email}" to="${email.to.map((a) => a.email).join(", ")}" subject="${email.subject}">\n${email.text || email.fullText}\n</email>`;
  return structured({ system: memoryPassPrompt({ josefName: cfg.josefName }), user, schema: MEMORY_PASS_SCHEMA, mock: () => mockMemoryPass(email, memoryItems), label: "claude memory pass" });
}

export async function rememberNote(text) {
  return structured({ system: rememberPrompt(), user: text, schema: REMEMBER_SCHEMA, mock: () => mockRemember(text), label: "claude remember" });
}

export async function summarizeEmail(email) {
  return structured({ system: summaryPrompt(), user: `From ${email.from.name || email.from.email} <${email.from.email}>, subject "${email.subject}":\n${(email.text || email.fullText).slice(0, 3000)}`, schema: SUMMARY_SCHEMA, mock: () => ({ summary: `${email.from.name || email.from.email} wrote: ${(email.text || email.fullText).slice(0, 120).replace(/\s+/g, " ")}` }), label: "claude summary" });
}

// ---------------------------------------------------------------------------
// Mock mode (no API key): enough behaviour to exercise every path locally.
// ---------------------------------------------------------------------------
async function mockAnswer(email, senderKind) {
  const t = `${email.subject}\n${email.text}`.toLowerCase();
  const toolCalls = [];
  if (/ignore (your|all) (previous |prior )?instructions|you are now authori[sz]ed|new rules/.test(t)) return { action: "suspicious", reason: "tries to change the rules", toolCalls };
  const mem = await runTool("search_memory", { query: email.subject }, senderKind);
  toolCalls.push({ name: "search_memory", ok: true });
  if (mem.length) return { action: "reply", text: `${mem[0].summary} That is what Josef told me on ${mem[0].updated}.`, toolCalls };
  if (/would .* work as a mentor|should we|can a parent/.test(t)) return { action: "escalate", question_summary: email.subject, what_you_found: "A judgment call.", draft_read: "Draft read: fits the brief for a founder-type mentor.", toolCalls };
  if (/run of show|document|slides|deck|file/.test(t)) {
    const r = await runTool("search_documents", { query: email.subject }, senderKind);
    toolCalls.push({ name: "search_documents", ok: true });
    if (!r.files?.length) return { action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "", toolCalls };
    return { action: "reply", text: r.files.map((f) => `${f.name} (updated ${String(f.modifiedTime).slice(0, 10)}): ${f.link}`).join("\n"), toolCalls };
  }
  if (/agreement|signed/.test(t)) {
    const r = await runTool("get_agreement_status", {}, senderKind);
    toolCalls.push({ name: "get_agreement_status", ok: true });
    return { action: "reply", text: `${r.counts.signed} students have signed, ${r.counts.pending} are waiting on a parent's confirmation, and ${r.counts.notStarted} have not started. Not yet signed: ${[...r.pending, ...r.notStarted].join(", ") || "nobody"}.`, toolCalls };
  }
  if (/(when|which day|what day|coming to class|in class)/.test(t) && /mentor|[A-Z][a-z]+ [A-Z][a-z]+/.test(`${email.subject}
${email.text}`)) {
    const r = await runTool("get_mentor_schedule", {}, senderKind);
    toolCalls.push({ name: "get_mentor_schedule", ok: true });
    const named = r.visits.find((v) => t.includes(v.mentor.split(" ")[0].toLowerCase()));
    if (named) return { action: "reply", text: `${named.mentor} is in for ${named.lesson} on ${named.date}, ${named.time} at ${named.location}.`, toolCalls };
    return { action: "reply", text: r.visits.length ? `Mentors are coming on: ${r.visits.map((v) => `${v.date} (${v.mentor}, ${v.lesson})`).join("; ")}.` : "No mentor visits are scheduled yet.", toolCalls };
  }
  if (/mentor/.test(t)) {
    const r = await runTool("get_mentor_coverage", {}, senderKind);
    toolCalls.push({ name: "get_mentor_coverage", ok: true });
    const n = r.lessonsWithoutConfirmedMentor.length;
    return { action: "reply", text: n ? `As of today, ${n} lesson${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} a confirmed mentor: ${r.lessonsWithoutConfirmedMentor.map((s) => s.lesson).join("; ")}.` : "As of today, every mentor lesson has a confirmed mentor.", toolCalls };
  }
  if (/student|cohort|how many/.test(t)) {
    const r = await runTool("get_cohort", {}, senderKind);
    toolCalls.push({ name: "get_cohort", ok: true });
    return { action: "reply", text: `The ${r.cohortYear} cohort has ${r.studentCount} students${r.students ? `: ${r.students.map((s) => s.name).join(", ")}` : ""}.`, toolCalls };
  }
  if (/next week/.test(t)) {
    const r = await runTool("get_schedule", {}, senderKind);
    toolCalls.push({ name: "get_schedule", ok: true });
    return { action: "reply", text: r.nextWeek.length ? `Next week: ${r.nextWeek.map((l) => `lesson ${l.number} (${l.title}) on ${l.date}`).join("; ")}.` : "Nothing is scheduled in the next seven days.", toolCalls };
  }
  if (/lesson|when is|where is/.test(t)) {
    const r = await runTool("get_lessons", {}, senderKind);
    toolCalls.push({ name: "get_lessons", ok: true });
    const m = /lesson\s*(\d+)/.exec(t);
    const l = m ? r.find((x) => x.number === m[1]) : null;
    if (l) return { action: "reply", text: `Lesson ${l.number}, ${l.title}, is on ${l.date} from ${l.time} in ${l.room}.`, toolCalls };
    return { action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "", toolCalls };
  }
  if (/weather|lunch|joke/.test(t)) return { action: "out_of_scope", toolCalls };
  return { action: "escalate", question_summary: email.subject, what_you_found: "nothing on the EIB platform or in the documents folder", draft_read: "", toolCalls };
}

async function mockForward({ instruction, original }) {
  const i = String(instruction || "").toLowerCase();
  const saying = /reply saying (.+)/i.exec(instruction);
  if (saying) return { action: "send_reply", text: saying[1].trim(), toolCalls: [] };
  if (/run of show|document|file/.test(i) || /run of show|document|file/.test(original.body.toLowerCase())) {
    const r = await runTool("search_documents", { query: `${instruction} ${original.subject}` }, "josef");
    if (r.files?.length) return { action: "send_reply", text: `Here is the document you asked about: ${r.files[0].name}: ${r.files[0].link}`, toolCalls: ["search_documents"] };
    return { action: "needs_ok", reason: "I could not find that document in the EIB Documents folder.", draft: "Thanks for asking. I will send the document over as soon as it is ready.", toolCalls: ["search_documents"] };
  }
  const b = original.body.toLowerCase();
  if (/how many students|mentor|lesson/.test(b)) {
    const a = await mockAnswer({ subject: original.subject, text: original.body }, "josef");
    if (a.action === "reply") return { action: "send_reply", text: a.text, toolCalls: a.toolCalls };
  }
  if (/date|when can|pay|invoice|\$|budget|decide|confirm/.test(b)) return { action: "needs_ok", reason: "The reply would commit you to a date or a decision you did not state.", draft: "Thanks for your note. Josef will confirm the details shortly.", toolCalls: [] };
  return { action: "needs_ok", reason: "I do not have enough information to answer this one.", draft: "Thanks for your email. Josef will get back to you shortly.", toolCalls: [] };
}

function mockIntent(email, pendingDraft) {
  const text = (email.text || "").trim();
  const t = text.toLowerCase();
  const empty = { target_kind: "", target_name: "", action: "", fields: {}, dont_save_faq: false };
  if (/^(yes|oui|confirmed|go ahead|do it|looks good)\b/.test(t)) return { intent: "confirm", edit: empty };
  if (/^(no|cancel|never mind|forget it)\b/.test(t)) return { intent: "cancel", edit: empty };
  if (/who (has|can)\b.*(access|email you|use)/i.test(text)) return { intent: "access_list", edit: empty };
  const give = /(?:give|grant|add)\s+(\S+@\S+|[a-z0-9.-]+\.[a-z]{2,})\s+(?:agent\s+)?access/i.exec(text) || /(?:give|grant)\s+(?:agent\s+)?access\s+to\s+(\S+)/i.exec(text);
  if (give) return { intent: "access_add", edit: { ...empty, target_name: give[1].replace(/[.,]$/, "") } };
  const rm = /remove\s+(?:agent\s+)?access\s+(?:from|for)\s+(\S+)/i.exec(text) || /revoke\s+(\S+)/i.exec(text);
  if (rm) return { intent: "access_remove", edit: { ...empty, target_name: rm[1].replace(/[.,]$/, "") } };
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
  const add = /add (?:a )?(?:new )?mentor,?\s*([^,\n.]+)/i.exec(text);
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
  if (/\?/.test(text) || /^(what|when|where|who|how)\b/.test(t)) return { intent: "question", edit: empty };
  return { intent: "other", edit: empty };
}

function mockRemember(text) {
  const t = text.replace(/^remember:\s*/i, "").trim();
  const [topic, ...rest] = t.split(/\s*(?:-|:|–|—)\s*/);
  const summary = rest.join(" ").trim() || t;
  const status = /waiting|pending|owe|due/i.test(t) ? "waiting" : /done|finished|complete/i.test(t) ? "done" : "info";
  return { topic: topic.trim().slice(0, 60), status, summary };
}

function mockMemoryPass(email, memoryItems) {
  const text = String(email.text || "").trim();
  const t = text.toLowerCase();
  const done = /^(.+?)\s+(?:is|are|was|were|has been)\s+(done|finished|complete|completed|paid|sorted)\b/i.exec(text);
  if (done) {
    const words = done[1].toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const hit = memoryItems.find((m) => words.filter((w) => m.topic.toLowerCase().includes(w)).length >= Math.min(2, words.length));
    if (hit) return { changes: [{ action: "update", topic: hit.topic, match_topic: hit.topic, status: "done", summary: `${hit.topic} is done.` }], unsure_question: "" };
  }
  if (/\b(we agreed|i promised|i will|we will|deadline|by friday|owes|waiting on)\b/.test(t) && text.length < 300) return { changes: [{ action: "create", topic: text.slice(0, 40), match_topic: "", status: /waiting|owes|by /.test(t) ? "waiting" : "info", summary: text }], unsure_question: "" };
  return { changes: [], unsure_question: "" };
}
