// The Claude call for AIDA: one streamed reply, no tools.
//
// Caching. The request is laid out oldest-and-most-shared first, and nothing already sent is ever
// edited, so each part is paid for once and then read back at a fraction of the price:
//   system[0]  shared text (same for the whole class)        cached 1 hour
//   system[1]  this student's lesson context                 cached 1 hour
//   messages   the conversation; the marker sits on the newest message
// One hour, not five minutes: students go quiet while they write, then come back.
//
// With no API key (the local sandbox) a small mock answers, so the smoke suite runs offline.

import Anthropic from "@anthropic-ai/sdk";
import { aidaConfig, MAX_REPLY_TOKENS } from "./config";

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
 * messages: [{ role: "user" | "assistant", text }], ending with the new user message.
 * onText is called with each piece of the reply as it is written.
 * Returns { text, usage: { input, output, cacheRead, cacheWrite }, stop }.
 */
export async function runChat({ shared, context, messages, onText }) {
  const c = client();
  if (!c) return mockChat({ context, messages, onText });
  const cfg = aidaConfig();
  const last = messages.length - 1;
  const stream = c.messages.stream({
    model: cfg.model,
    max_tokens: MAX_REPLY_TOKENS,
    output_config: { effort: "low" },
    system: [
      { type: "text", text: shared, cache_control: CACHE },
      { type: "text", text: context, cache_control: CACHE },
    ],
    messages: messages.map((m, i) => ({ role: m.role, content: [{ type: "text", text: m.text, ...(i === last ? { cache_control: CACHE } : {}) }] })),
  });
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  const u = final.usage || {};
  const usage = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 };
  console.log(`[eib aida] ${cfg.model} stop=${final.stop_reason} in=${usage.input} out=${usage.output} cache_read=${usage.cacheRead} cache_write=${usage.cacheWrite}`);
  if (!text.trim()) {
    // A refusal, or the reply ran out of room before any words were written.
    text = final.stop_reason === "refusal" ? "I can't help with that one. Let's get back to your venture: what are you working on in this lesson?" : "I lost my train of thought there. Could you ask that again?";
    onText(text);
  }
  return { text, usage, stop: final.stop_reason };
}

async function mockChat({ context, messages, onText }) {
  const said = messages[messages.length - 1].text;
  const lesson = (context.match(/opened you from (Lesson .+?)\. That is/) || [0, "this lesson"])[1];
  const text = `[Sandbox reply, no AI key set] I am looking at ${lesson}. I can see ${(context.match(/^### /gm) || []).length} deliverable(s). You said: ${said.replace(/<updated_work[\s\S]*<\/updated_work>\s*/g, "").slice(0, 200)}`;
  for (const piece of text.match(/.{1,40}/gs) || []) onText(piece);
  return { text, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, stop: "end_turn" };
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
