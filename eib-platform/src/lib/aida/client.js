// The Claude calls for AIDA: one streamed reply that can search the web, for the student AIDA (runChat)
// and for AIDA Unlocked (runUnlocked).
//
// Caching. The request is laid out oldest-and-most-shared first, and nothing already sent is ever
// edited, so each part is paid for once and then read back at a fraction of the price:
// The student AIDA:
//   system[0]  shared text (same for the whole class)        cached 1 hour
//   system[1]  this student's lesson context                 cached 1 hour
//   messages   the conversation; the marker sits on the newest message
// One hour, not five minutes: students go quiet while they write, then come back.
//
// With no API key (the local sandbox) a small mock answers, so the smoke suite runs offline.

import Anthropic from "@anthropic-ai/sdk";
import { aidaConfig, MAX_REPLY_TOKENS, AIDA_MAX_SEARCHES, UNLOCKED_REPLY_TOKENS, UNLOCKED_MAX_SEARCHES } from "./config";
import { SEARCHING_MARK } from "./unlocked";

const CACHE = { type: "ephemeral", ttl: "1h" };
const g = globalThis;
function client() {
  const { anthropicKey } = aidaConfig();
  if (!anthropicKey) return null;
  if (!g.__eibAidaAnthropic) g.__eibAidaAnthropic = new Anthropic({ apiKey: anthropicKey, maxRetries: 2, timeout: 90_000 });
  return g.__eibAidaAnthropic;
}

export const aidaLive = () => Boolean(aidaConfig().anthropicKey);

/**
 * One reply, streamed, with web search. Shared by both AIDAs.
 *
 * The search runs on Anthropic's side. A long piece of research can come back "paused": the reply so
 * far is sent back as it is and the model carries on. While a search runs, SEARCHING_MARK is written
 * into the stream so the page can say so (it is not part of the returned text); the pages cited are
 * listed under the reply.
 * `extra` holds request options that are in beta: if the API turns the request down before a word is
 * written, it is asked once more without them.
 */
async function converse(c, { tag, model, maxTokens, effort, system, messages, searches, extra = null, onText }) {
  const last = messages.length - 1;
  const turns = messages.map((m, i) => ({ role: m.role, content: [{ type: "text", text: m.text, ...(i === last ? { cache_control: CACHE } : {}) }] }));
  const base = { model, max_tokens: maxTokens, output_config: { effort }, system, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: searches }] };

  let text = "";
  let gap = false; // a search happened since the last words, so the next words start a new paragraph
  let stop = "end_turn";
  const usage = { model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
  const sources = new Map();
  for (let round = 0; round < 4; round++) {
    let final;
    try {
      const params = { ...base, ...(extra || {}), messages: turns };
      const stream = extra ? c.beta.messages.stream(params, { timeout: 280_000 }) : c.messages.stream(params, { timeout: 280_000 });
      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          gap = true;
          onText(SEARCHING_MARK);
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const piece = gap && text && !text.endsWith("\n") ? `\n\n${event.delta.text}` : event.delta.text;
          gap = false;
          text += piece;
          onText(piece);
        }
      }
      final = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && extra && !text && round === 0) {
        console.error(`[eib ${tag}] retrying without beta options: ${e.message}`);
        extra = null;
        round--;
        continue;
      }
      throw e;
    }
    const u = final.usage || {};
    usage.input += u.input_tokens || 0;
    usage.output += u.output_tokens || 0;
    usage.cacheRead += u.cache_read_input_tokens || 0;
    usage.cacheWrite += u.cache_creation_input_tokens || 0;
    usage.searches += u.server_tool_use?.web_search_requests || 0;
    for (const block of final.content) {
      if (block.type !== "text") continue;
      for (const cite of block.citations || []) if (cite.url && !sources.has(cite.url)) sources.set(cite.url, cite.title || cite.url);
    }
    stop = final.stop_reason;
    if (stop !== "pause_turn") break;
    turns.push({ role: "assistant", content: final.content });
  }
  console.log(`[eib ${tag}] ${model} stop=${stop} in=${usage.input} out=${usage.output} cache_read=${usage.cacheRead} cache_write=${usage.cacheWrite} searches=${usage.searches}`);
  const say = (t) => {
    text += t;
    onText(t);
  };
  return { text: () => text, say, usage, stop, sources };
}

// Told to the model after the cached parts, so a new day does not mean reading everything again at full price.
const TODAY = () => `Today's date is ${new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}.`;
const sourceList = (sources) => `\n\nSources:\n${[...sources].slice(0, 12).map(([url, title]) => `${title}: ${url}`).join("\n")}`;

/**
 * The student AIDA.
 * messages: [{ role: "user" | "assistant", text }], ending with the new user message.
 * onText is called with each piece of the reply as it is written.
 * Returns { text, usage: { model, input, output, cacheRead, cacheWrite, searches }, stop }.
 */
export async function runChat({ shared, context, messages, onText }) {
  const c = client();
  if (!c) return mockChat({ shared, context, messages, onText });
  const r = await converse(c, {
    tag: "aida",
    model: aidaConfig().model,
    maxTokens: MAX_REPLY_TOKENS,
    effort: "low",
    system: [
      { type: "text", text: shared, cache_control: CACHE },
      { type: "text", text: context, cache_control: CACHE },
      { type: "text", text: TODAY() },
    ],
    messages,
    searches: AIDA_MAX_SEARCHES,
    onText,
  });
  // A refusal, or the reply ran out of room before any words were written.
  if (!r.text().trim()) r.say(r.stop === "refusal" ? "I can't help with that one. Let's get back to your venture: what are you working on in this lesson?" : "I lost my train of thought there. Could you ask that again?");
  else if (r.sources.size) r.say(sourceList(r.sources));
  return { text: r.text(), usage: r.usage, stop: r.stop };
}

/**
 * AIDA Unlocked.
 *
 *   system[0]  how it behaves + the EIB method (same for everyone)   cached 1 hour
 *   system[1]  today's date (changes once a day, after the cached part)
 *   messages   the conversation; the marker sits on the newest message
 *
 * If the model declines a message, Anthropic's default fallback model answers instead.
 */
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
export async function runUnlocked({ system, messages, onText }) {
  const c = client();
  if (!c) return mockUnlocked({ system, messages, onText });
  const r = await converse(c, {
    tag: "aida unlocked",
    model: aidaConfig().unlockedModel,
    maxTokens: UNLOCKED_REPLY_TOKENS,
    effort: "medium",
    system: [
      { type: "text", text: system, cache_control: CACHE },
      { type: "text", text: TODAY() },
    ],
    messages,
    searches: UNLOCKED_MAX_SEARCHES,
    extra: FALLBACK,
    onText,
  });
  if (!r.text().trim()) r.say(r.stop === "refusal" ? "I can't help with that one. What are you working on in the venture?" : "I lost my train of thought there. Could you ask that again?");
  else if (r.stop === "max_tokens") r.say("\n\n(I ran out of room there. Say \"continue\" and I will pick up where I stopped.)");
  else if (r.stop === "pause_turn") r.say("\n\n(That research ran long and I stopped before finishing. Say \"continue\" and I will carry on.)");
  if (r.sources.size) r.say(sourceList(r.sources));
  return { text: r.text(), usage: r.usage, stop: r.stop };
}

async function mockUnlocked({ system, messages, onText }) {
  const said = messages[messages.length - 1].text;
  const method = (system.match(/<eib_method>\n([\s\S]*?)\n<\/eib_method>/) || [0, ""])[1];
  const full = `[Sandbox reply, no AI key set] AIDA Unlocked here. Method loaded: ${method ? `${method.split(/\s+/).length} words` : "none"}. Messages so far: ${messages.length}. You said: ${said.slice(0, 200)}${/search/i.test(said) ? `\n${SEARCHING_MARK}\n\nSources:\nExample: https://example.com/smoke` : ""}`;
  for (const piece of full.match(/.{1,40}/gs) || []) onText(piece);
  return { text: full, usage: { model: aidaConfig().unlockedModel, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 }, stop: "end_turn" };
}

async function mockChat({ shared, context, messages, onText }) {
  const said = messages[messages.length - 1].text;
  const lesson = (context.match(/opened you from (Lesson .+?)\. That is/) || [0, "this lesson"])[1];
  const text = `[Sandbox reply, no AI key set] I am looking at ${lesson}. I can see ${(context.match(/^### /gm) || []).length} deliverable(s). You said: ${said.replace(/<updated_work[\s\S]*<\/updated_work>\s*/g, "").slice(0, 200)}${/show me/i.test(said) ? `\n[[show:${(shared.match(/\(id: ([^)]+)\)/) || [0, "none"])[1]}]]` : ""}`;
  const drafted = /draft it/i.test(said) ? `\n[[draft:${(shared.match(/\(id: ([^)]+)\)/) || [0, "none"])[1]}]]\nSANDBOX-DRAFT one\nSANDBOX-DRAFT two\n[[/draft]]\nWant any changes?` : "";
  const updated = ((said.match(/<updated_work[\s\S]*<\/updated_work>/) || [""])[0].match(/^### /gm) || []).length;
  const full = (updated ? `${text}\nChanged answers received with this message: ${updated}.` : text) + drafted;
  for (const piece of full.match(/.{1,40}/gs) || []) onText(piece);
  return { text: full, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stop: "end_turn" };
}

/** A streamed text response. `run(send)` writes the reply; an error ends it with a marker the page shows as a notice. */
export const ERROR_MARK = "[[AIDA_ERROR]]";
export function streamResponse(run) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (t) => controller.enqueue(encoder.encode(t));
      try {
        await run(send);
      } catch (e) {
        console.error(`[eib aida] FAILED: ${e?.message || e}`);
        send(`${ERROR_MARK}AIDA could not answer just now. Please try again in a moment.`);
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
