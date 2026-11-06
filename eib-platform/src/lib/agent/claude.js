// Claude calls: the answer loop with tools, and two structured-output calls (Josef's intent, relaying an
// answer). With no ANTHROPIC_API_KEY (the local sandbox) a small mock answers instead so the whole flow can be
// exercised by scripts/agent-smoke.mjs.

import Anthropic from "@anthropic-ai/sdk";
import { agentConfig, MAX_TOOL_ROUNDS } from "./config";
import { answerSystemPrompt, josefIntentPrompt, JOSEF_INTENT_SCHEMA, relayPrompt, RELAY_SCHEMA } from "./prompts";
import { TOOL_DEFINITIONS, TERMINAL_TOOLS, TERMINAL_NAMES, runTool } from "./tools";

const g = globalThis;
function client() {
  const { anthropicKey } = agentConfig();
  if (!anthropicKey) return null;
  if (!g.__eibAnthropic) g.__eibAnthropic = new Anthropic({ maxRetries: 3 });
  return g.__eibAnthropic;
}

/**
 * Answer mode. Returns { action: "reply" | "escalate" | "out_of_scope" | "suspicious", ...tool input, toolCalls }.
 */
export async function runAnswer({ email, senderKind, senderName, threadContext }) {
  const cfg = agentConfig();
  const c = client();
  const userText = [threadContext ? `<thread_so_far>\n${threadContext}\n</thread_so_far>` : "", `<email from="${email.from.name || email.from.email}" subject="${email.subject}">\n${email.text || email.fullText}\n</email>`]
    .filter(Boolean)
    .join("\n\n");
  if (!c) return mockAnswer(email, senderKind);

  const system = answerSystemPrompt({ josefName: cfg.josefName, senderKind, senderName });
  const tools = [...TOOL_DEFINITIONS, ...TERMINAL_TOOLS];
  const messages = [{ role: "user", content: userText }];
  const toolCalls = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await c.messages.create({ model: cfg.model, max_tokens: 8000, system, messages, tools, output_config: { effort: "medium" } });
    const uses = res.content.filter((b) => b.type === "tool_use");
    if (res.stop_reason === "refusal") return { action: "escalate", question_summary: email.subject, what_you_found: "The model declined to process this email.", draft_read: "", toolCalls };
    if (!uses.length) {
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      return { action: "reply", text: text || "I could not work out an answer; I am checking with Josef.", toolCalls, fallback: !text };
    }
    const terminal = uses.find((u) => TERMINAL_NAMES.has(u.name));
    if (terminal) return { action: terminal.name, ...terminal.input, toolCalls };
    messages.push({ role: "assistant", content: res.content });
    const results = [];
    for (const u of uses) {
      let result;
      try {
        result = await runTool(u.name, u.input || {}, senderKind);
      } catch (e) {
        result = { error: String(e?.message || e) };
      }
      toolCalls.push({ name: u.name, input: u.input, ok: !result?.error });
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
  }
  return { action: "escalate", question_summary: email.subject, what_you_found: "Too many lookups without a conclusion.", draft_read: "", toolCalls };
}

async function structured({ system, user, schema, mock }) {
  const cfg = agentConfig();
  const c = client();
  if (!c) return mock();
  const res = await c.messages.create({
    model: cfg.model,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low", format: { type: "json_schema", schema } },
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

/** What does Josef want? */
export async function classifyJosefIntent({ email, pendingDraft }) {
  const cfg = agentConfig();
  const user = [
    pendingDraft ? `<pending_edit>\nThe assistant is waiting on this ${pendingDraft.kind} ${pendingDraft.action}: ${JSON.stringify(pendingDraft.fields)}. Still missing: ${pendingDraft.missing.join(", ") || "nothing; awaiting YES"}.\n</pending_edit>` : "",
    `<email subject="${email.subject}">\n${email.text || email.fullText}\n</email>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return structured({ system: josefIntentPrompt({ josefName: cfg.josefName }), user, schema: JOSEF_INTENT_SCHEMA, mock: () => mockIntent(email, pendingDraft) });
}

/** Josef's reply to an escalation, rewritten for the asker. */
export async function relayAnswer({ question, josefReply, askerName }) {
  const cfg = agentConfig();
  return structured({
    system: relayPrompt({ josefName: cfg.josefName }),
    user: `<question from="${askerName}">\n${question}\n</question>\n<josef_reply>\n${josefReply}\n</josef_reply>`,
    schema: RELAY_SCHEMA,
    mock: () => ({ answer: josefReply.trim(), save_to_faq: !/don'?t save|do not save|one[- ]off/i.test(josefReply) }),
  });
}

// ---------------------------------------------------------------------------
// Mock mode (no API key): enough behaviour to exercise every path locally.
// ---------------------------------------------------------------------------
async function mockAnswer(email, senderKind) {
  const t = `${email.subject}\n${email.text}`.toLowerCase();
  const toolCalls = [];
  if (/ignore (your|all) (previous |prior )?instructions|you are now authori[sz]ed|new rules/.test(t)) return { action: "suspicious", reason: "tries to change the rules", toolCalls };
  const faq = await runTool("search_faq", { query: email.subject }, senderKind);
  toolCalls.push({ name: "search_faq", ok: true });
  if (faq.length) return { action: "reply", text: `${faq[0].answer} (Josef answered this on ${faq[0].answeredOn}.)`, toolCalls };
  if (/would .* work as a mentor|should we|can a parent/.test(t)) return { action: "escalate", question_summary: email.subject, what_you_found: "A judgment call.", draft_read: "Draft read: fits the brief for a founder-type mentor.", toolCalls };
  if (/run of show|document|slides|deck/.test(t)) {
    const r = await runTool("search_documents", { query: email.subject }, senderKind);
    toolCalls.push({ name: "search_documents", ok: true });
    if (!r.files?.length) return { action: "escalate", question_summary: email.subject, what_you_found: "nothing in joineib or the docs folder", draft_read: "", toolCalls };
    return { action: "reply", text: r.files.map((f) => `${f.name} (updated ${String(f.modifiedTime).slice(0, 10)}): ${f.link}`).join("\n"), toolCalls };
  }
  if (/mentor/.test(t)) {
    const r = await runTool("get_open_mentor_slots", {}, senderKind);
    toolCalls.push({ name: "get_open_mentor_slots", ok: true });
    const n = r.openSlots.length;
    return { action: "reply", text: n ? `As of today, ${n} lesson${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} a confirmed mentor: ${r.openSlots.map((s) => s.lesson).join("; ")}.` : "As of today, every mentor lesson has a confirmed mentor.", toolCalls };
  }
  if (/student|cohort|how many/.test(t)) {
    const r = await runTool("get_cohort", {}, senderKind);
    toolCalls.push({ name: "get_cohort", ok: true });
    return { action: "reply", text: `The ${r.cohortYear} cohort has ${r.studentCount} students${r.students ? `: ${r.students.join(", ")}` : ""}.`, toolCalls };
  }
  if (/lesson|when is|where is/.test(t)) {
    const r = await runTool("get_lessons", {}, senderKind);
    toolCalls.push({ name: "get_lessons", ok: true });
    const m = /lesson\s*(\d+)/.exec(t);
    const l = m ? r.find((x) => x.number === m[1]) : null;
    if (l) return { action: "reply", text: `Lesson ${l.number}, ${l.title}, is on ${l.date} from ${l.time} in ${l.room}.`, toolCalls };
    return { action: "escalate", question_summary: email.subject, what_you_found: "nothing in joineib or the docs folder", draft_read: "", toolCalls };
  }
  if (/weather|lunch|joke/.test(t)) return { action: "out_of_scope", toolCalls };
  return { action: "escalate", question_summary: email.subject, what_you_found: "nothing in joineib or the docs folder", draft_read: "", toolCalls };
}

function mockIntent(email, pendingDraft) {
  const text = (email.text || "").trim();
  const t = text.toLowerCase();
  const empty = { target_kind: "", target_name: "", action: "", fields: {}, dont_save_faq: false };
  if (/^(yes|oui|confirmed|go ahead|do it|looks good)\b/.test(t)) return { intent: "confirm", edit: empty };
  if (/^(no|cancel|never mind|forget it)\b/.test(t)) return { intent: "cancel", edit: empty };
  const undo = /undo the last change to (.+)/i.exec(text);
  if (undo) return { intent: "undo", edit: { ...empty, target_kind: "mentor", target_name: undo[1].trim().replace(/[.!]$/, "") } };
  const fields = {};
  for (const [key, re] of Object.entries({
    email: /email:?\s*([^\s,]+@[^\s,]+)/i,
    phone: /phone:?\s*([+()\d\s-]{7,})/i,
    linkedin: /linkedin:?\s*(\S+)/i,
    organization: /organi[sz]ation:?\s*([^,\n]+)/i,
    title: /title:?\s*([^,\n]+)/i,
    status: /status:?\s*(contacted|responsive|unresponsive|unsure|confirmed)/i,
    lesson: /lesson:?\s*(\d+)/i,
    notes: /notes?:?\s*([^\n]+)/i,
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
