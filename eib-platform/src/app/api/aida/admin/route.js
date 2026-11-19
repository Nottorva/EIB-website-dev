// The AIDA page (super admin).
//
// GET                              everything the page needs: settings, every lesson's AI instructions and
//                                  linked deliverables, the students to test as, and usage
// GET  ?preview=1&lesson=&student= exactly what AIDA is given for that lesson and that student's work
// PUT  { settings }                mode, daily limit, general context, core prompt
// PUT  { lesson: { id, aiInstructions, aidaLinks } }
// POST { lessonId, studentId, messages }   the Test tab: a reply, streamed; nothing is saved
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

// What AIDA would be given for this lesson, seen as this student (or with no work at all).
async function assemble(lessonId, studentId) {
  const [lessons, settings] = await Promise.all([listLessons(), getAidaSettings()]);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new HttpError(404, "Lesson not found.");
  const payloads = studentId ? payloadMap(await listSubmissions({ studentId })) : {};
  return { shared: sharedText({ settings, lessons: lessons.filter((l) => l.studentVisible || l.id === lesson.id) }), context: buildContext({ lesson, lessons, payloads }).text };
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
    lessons: lessons.map((l) => ({ id: l.id, number: l.number, title: l.title, studentVisible: l.studentVisible, aiInstructions: l.aiInstructions || "", aidaLinks: l.aidaLinks || [], deliverables: l.deliverables.map((d) => ({ id: d.id, title: d.title, type: d.type })) })),
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
    out.lesson = { id: saved.id, aiInstructions: saved.aiInstructions, aidaLinks: saved.aidaLinks };
  }
  return Response.json(out);
});

export const POST = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .map((m) => ({ role: m.role, text: String(m.content).slice(0, m.role === "user" ? MAX_MESSAGE_CHARS : 20000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Type a message first.");
  const { shared, context } = await assemble(body.lessonId, body.studentId || "");
  return streamResponse(async (send) => {
    const reply = await runChat({ shared, context, messages, onText: send });
    await recordUsage(user.id, reply.usage);
  });
});
