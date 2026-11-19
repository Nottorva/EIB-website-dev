// AIDA for students, opened from a lesson on the Lessons page.
//
// GET    ?lesson=ID   the conversation so far, what is left of today's allowance, and whether AIDA is
//                     closed right now (the hours set on the AIDA page)
// POST   { lessonId, message }   the reply, streamed as plain text
// DELETE ?lesson=ID   start a fresh chat (the old one is kept for staff)
//
// The student is always the signed-in one: the browser never says whose work to read. The deliverables
// AIDA sees are loaded here, on the server, for that student only.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listLessons } from "@/lib/data/lessons";
import { listSubmissions } from "@/lib/data/submissions";
import { needsAgreement } from "@/lib/data/agreement";
import { MAX_MESSAGE_CHARS, MAX_CONVERSATION_MESSAGES } from "@/lib/aida/config";
import { sharedText, buildContext, contextKey, changedWork, sentHashes, payloadMap } from "@/lib/aida/context";
import { getAidaSettings, aidaOpenFor, closedNote, getConversation, newConversation, saveConversation, archiveConversation, usageToday, recordUsage } from "@/lib/aida/store";
import { runChat, streamResponse } from "@/lib/aida/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function open(user, lessonId) {
  if (await needsAgreement(user)) throw new HttpError(403, "Please sign the Student Agreement first.");
  const settings = await getAidaSettings();
  if (!aidaOpenFor(user, settings)) throw new HttpError(403, "AIDA is not switched on.");
  const lessons = (await listLessons()).filter((l) => l.studentVisible);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new HttpError(404, "Lesson not found.");
  return { settings, lessons, lesson };
}

const shown = (conv) => (conv?.messages || []).map((m) => ({ role: m.role, content: m.content, at: m.at }));

export const GET = guarded(["student"], async ({ req, user }) => {
  const { settings, lesson } = await open(user, new URL(req.url).searchParams.get("lesson"));
  const [conv, usage] = await Promise.all([getConversation(user.id, lesson.id), usageToday(user.id)]);
  // Outside the set hours the student can still read their chat; `closed` says when AIDA is open.
  return Response.json({ messages: shown(conv), remaining: Math.max(0, settings.dailyLimit - usage.messages), closed: closedNote(settings) });
});

export const POST = guarded(["student"], async ({ req, user }) => {
  const body = await readJson(req);
  const message = String(body.message || "").trim();
  if (!message) throw new HttpError(400, "Type a message first.");
  if (message.length > MAX_MESSAGE_CHARS) throw new HttpError(400, `That message is too long (${MAX_MESSAGE_CHARS} characters at most).`);
  const { settings, lessons, lesson } = await open(user, body.lessonId);
  const closed = closedNote(settings);
  if (closed) throw new HttpError(403, closed);

  const usage = await usageToday(user.id);
  if (usage.messages >= settings.dailyLimit) throw new HttpError(429, "You have reached today's limit for AIDA. It resets tomorrow.");

  const conv = (await getConversation(user.id, lesson.id)) || newConversation(user.id, lesson.id);
  if (conv.messages.length >= MAX_CONVERSATION_MESSAGES) throw new HttpError(409, "This chat has become very long. Start a new chat to keep going.");

  const payloads = payloadMap(await listSubmissions({ studentId: user.id }));
  const built = buildContext({ lesson, lessons, payloads });
  // The student's work is frozen when a conversation starts (so it stays cached) and rebuilt only if
  // the lessons themselves were edited. Answers the student changes afterwards ride along with their message.
  const key = contextKey({ lesson, lessons });
  if (conv.contextKey !== key || !conv.context) {
    conv.contextKey = key;
    conv.context = built.text;
    conv.sent = sentHashes(built.parts);
  }
  const updates = changedWork({ parts: built.parts, sent: conv.sent, lessons });
  const sent = updates ? `${updates}\n\n${message}` : message;
  const history = [...conv.messages.map((m) => ({ role: m.role, text: m.sent || m.content })), { role: "user", text: sent }];
  const shared = sharedText({ settings, lessons });

  return streamResponse(async (send) => {
    const reply = await runChat({ shared, context: conv.context, messages: history, onText: send });
    const at = new Date().toISOString();
    conv.messages.push({ role: "user", content: message, ...(updates ? { sent } : {}), at }, { role: "assistant", content: reply.text, at, usage: reply.usage });
    conv.sent = sentHashes(built.parts);
    await saveConversation(conv);
    await recordUsage(user.id, reply.usage);
  });
});

export const DELETE = guarded(["student"], async ({ req, user }) => {
  const { lesson } = await open(user, new URL(req.url).searchParams.get("lesson"));
  await archiveConversation(user.id, lesson.id);
  return Response.json({ ok: true });
});
