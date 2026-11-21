// AIDA Unlocked, the demo AI cofounder (super admin).
//
// GET                      what the page needs: whether a key is set, the model, and the method file's details
// PUT  { knowledge, name } replace the method file (the textbook chapters and class slides, as plain text)
// POST { messages }        a reply, streamed; the conversation lives in the browser and is not saved here
import { guarded, readJson, HttpError } from "@/lib/auth";
import { aidaConfig } from "@/lib/aida/config";
import { recordUsage } from "@/lib/aida/store";
import { runUnlocked, streamResponse, aidaLive } from "@/lib/aida/client";
import { getKnowledge, saveKnowledge, unlockedSystem, UNLOCKED_MAX_CHARS, MAX_KNOWLEDGE_CHARS, SEARCHING_MARK } from "@/lib/aida/unlocked";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The conversation is re-read on every message, so a very long one asks for a fresh chat. */
const MAX_MESSAGES = 120;

export const GET = guarded(["superAdmin"], async () => {
  const { name, words, updatedAt } = await getKnowledge();
  return Response.json({ live: aidaLive(), model: aidaConfig().unlockedModel, maxChars: UNLOCKED_MAX_CHARS, knowledge: { name, words, updatedAt } });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (typeof body.knowledge !== "string") throw new HttpError(400, "Send the method as text.");
  if (body.knowledge.length > MAX_KNOWLEDGE_CHARS) throw new HttpError(400, "That file is too large for AIDA Unlocked to read on every message.");
  return Response.json({ knowledge: await saveKnowledge(body.knowledge, body.name) });
});

export const POST = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => ({ role: m.role, text: String(m.content || "").replaceAll(SEARCHING_MARK, "").trim().slice(0, m.role === "user" ? UNLOCKED_MAX_CHARS : 60000) }))
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.text);
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Type a message first.");
  if (messages.length > MAX_MESSAGES) throw new HttpError(400, "This chat has got very long. Start a new chat to carry on.");
  const system = unlockedSystem((await getKnowledge()).text);
  return streamResponse(async (send) => {
    const reply = await runUnlocked({ system, messages, onText: send });
    await recordUsage(user.id, reply.usage);
  });
});
