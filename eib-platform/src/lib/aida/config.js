// AIDA (Artificial Intelligence Deliverable Assistant): the student's AI cofounder.
// Settings from the environment, the limits, and the prices used for the cost ledger.

export const aidaConfig = () => ({
  // Its own key when set (a separate Console workspace with its own spend limit); else the site's key.
  anthropicKey: process.env.AIDA_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  model: process.env.AIDA_MODEL || "claude-sonnet-5-5",
});

/** Who may open AIDA on the Lessons page: nobody, the test account only, or every student. */
export const AIDA_MODES = ["off", "test", "on"];
export const DEFAULT_DAILY_LIMIT = 60;
/** One student message, in characters. */
export const MAX_MESSAGE_CHARS = 2000;
/** A conversation this long asks for a fresh chat (the whole history is re-read on every message). */
export const MAX_CONVERSATION_MESSAGES = 80;
/** Ceiling on one reply, reasoning included. Room for a whole deliverable written out; most replies are far shorter. */
export const MAX_REPLY_TOKENS = 3000;

/** US dollars per million tokens (Claude Sonnet 5.5, 1-hour cache writes). */
const PRICE = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 4 };
export function costOf(usage) {
  const u = usage || {};
  return ((u.input || 0) * PRICE.input + (u.output || 0) * PRICE.output + (u.cacheRead || 0) * PRICE.cacheRead + (u.cacheWrite || 0) * PRICE.cacheWrite) / 1_000_000;
}
