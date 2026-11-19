// The AIDA page (super admin).
//
// GET                              everything the pages need: settings, every lesson's AI instructions,
//                                  the students whose work can be read on /aida/chat, and usage
// GET  ?preview=1&lesson=&student= exactly what AIDA is given for that lesson and that student's work
// PUT  { settings }                mode, daily limit, general context, core prompt
// PUT  { lesson: { id, aiInstructions } }
// POST { lessonId, studentId, messages, edits }   /aida/chat: a reply, streamed; nothing is saved.
//      `edits` are the super admin's trial changes to that student's answers ("lessonId:deliverableId" ->
//      payload). AIDA sees them; the student's real work is never touched.
// POST { preview: true, lessonId, studentId, edits }  what AIDA would be given, as JSON
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listLessons, updateLessonAida } from "@/lib/data/lessons";
import { listUsers } from "@/lib/data/users";
import { listSubmissions } from "@/lib/data/submissions";
import { aidaConfig, MAX_MESSAGE_CHARS } from "@/lib/aida/config";
import { DEFAULT_PROMPT } from "@/lib/aida/prompt";
import { sharedText, buildContext, payloadMap } from "@/lib/aida/context";
import { getAidaSettings, saveAidaSettings, usageSummary, recordUsage } from "@/lib/aida/store";
import { runChat, streamResponse, aidaLive } from "@/lib/aida/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// What AIDA would be given when opened from this lesson, reading this student's work (or none).
// Published lessons, plus the chosen one if it is still a draft, so a lesson can be tried before it goes out.
async function assemble(lessonId, studentId, edits) {
  const [lessons, settings] = await Promise.all([listLessons(), getAidaSettings()]);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new HttpError(404, "Lesson not found.");
  const payloads = { ...(studentId ? payloadMap(await listSubmissions({ studentId })) : {}), ...(edits && typeof edits === "object" ? edits : {}) };
  const visible = lessons.filter((l) => l.studentVisible || l.id === lesson.id);
  return { shared: sharedText({ settings, lessons: visible }), context: buildContext({ lesson, lessons: visible, payloads }).text };
}

export const GET = guarded(["superAdmin"], async ({ req }) => {
  const q = new URL(req.url).searchParams;
  if (q.get("preview")) return Response.json(await assemble(q.get("lesson"), q.get("student") || ""));
  const [lessons, settings, students, usage] = await Promise.all([listLessons(), getAidaSettings(), listUsers({ role: "student" }), usageSummary()]);
  return Response.json({
    settings,
    defaultPrompt: DEFAULT_PROMPT,
    live: aidaLive(),
    model: aidaConfig().model,
    usage,
    lessons: lessons.map((l) => ({ id: l.id, number: l.number, title: l.title, studentVisible: l.studentVisible, aiInstructions: l.aiInstructions || "", deliverables: l.deliverables })),
    students: students.filter((u) => !u.suspended).map((u) => ({ id: u.id, name: u.name, isTest: u.isTest === true })).sort((a, b) => Number(b.isTest) - Number(a.isTest) || a.name.localeCompare(b.name)),
  });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const out = {};
  if (body.settings) out.settings = await saveAidaSettings(body.settings);
  if (body.lesson) {
    const saved = await updateLessonAida(body.lesson.id, body.lesson);
    if (!saved) throw new HttpError(404, "Lesson not found.");
    out.lesson = { id: saved.id, aiInstructions: saved.aiInstructions };
  }
  return Response.json(out);
});

export const POST = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  if (body.preview) return Response.json(await assemble(body.lessonId, body.studentId || "", body.edits));
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({ role: m.role, text: String(m.content).slice(0, m.role === "user" ? MAX_MESSAGE_CHARS : 20000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Type a message first.");
  const { shared, context } = await assemble(body.lessonId, body.studentId || "", body.edits);
  return streamResponse(async (send) => {
    const reply = await runChat({ shared, context, messages, onText: send });
    await recordUsage(user.id, reply.usage);
  });
});
