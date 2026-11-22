// AIDA (Artificial Intelligence Deliverable Assistant): the student's AI cofounder.
// Settings from the environment, the limits, and the prices used for the cost ledger.

export const aidaConfig = () => ({
  // Its own key when set (a separate Console workspace with its own spend limit); else the site's key.
  anthropicKey: process.env.AIDA_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  model: process.env.AIDA_MODEL || "claude-sonnet-5-5",
  // AIDA Unlocked (the demo cofounder) does longer, harder work, so it runs on the larger model.
  unlockedModel: process.env.AIDA_UNLOCKED_MODEL || "claude-opus-5-5",
});

/** Who may open AIDA on the Lessons page: nobody or every student. */
export const AIDA_MODES = ["off", "on"];
export const DEFAULT_DAILY_LIMIT = 60;
/** One student message, in characters. */
export const MAX_MESSAGE_CHARS = 2000;
/** A conversation this long asks for a fresh chat (the whole history is re-read on every message). */
export const MAX_CONVERSATION_MESSAGES = 80;
/** Ceiling on one reply, reasoning and searching included. Room for a whole deliverable written out; most replies are far shorter. */
export const MAX_REPLY_TOKENS = 6000;
/** Web searches the student AIDA may run for one message. */
export const AIDA_MAX_SEARCHES = 3;

/** Ceiling on one AIDA Unlocked reply: room for a full piece of research written out. */
export const UNLOCKED_REPLY_TOKENS = 16000;
/** Web searches AIDA Unlocked may run for one message. */
export const UNLOCKED_MAX_SEARCHES = 6;

/** US dollars per million tokens (1-hour cache writes cost twice the input price). */
const PRICE = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 4 }; // Claude Sonnet 5.5
const PRICE_OPUS = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 8 }; // Claude Opus 5.5
/** US dollars for one web search. */
const SEARCH_PRICE = 0.01;
/** `usage.model` picks the price list (the student AIDA's by default); `usage.searches` are web searches. */
export function costOf(usage) {
  const u = usage || {};
  const price = /opus/.test(u.model || "") ? PRICE_OPUS : PRICE;
  return ((u.input || 0) * price.input + (u.output || 0) * price.output + (u.cacheRead || 0) * price.cacheRead + (u.cacheWrite || 0) * price.cacheWrite) / 1_000_000 + (u.searches || 0) * SEARCH_PRICE;
}
