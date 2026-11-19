// GET /api/lessons/export            every lesson the caller can see
// GET /api/lessons/export?lesson=ID  one lesson
// Downloads a Markdown file: each lesson's tasks with the caller's own
// answers to them (see lib/data/exportMd.js). Students get
// their answers; staff get the same file with the answers blank.
import { guarded, HttpError } from "@/lib/auth";
import { listLessons } from "@/lib/data/lessons";
import { listSubmissions } from "@/lib/data/submissions";
import { getCohortYear } from "@/lib/data/settings";
import { needsAgreement } from "@/lib/data/agreement";
import { exportMarkdown, exportFileName } from "@/lib/data/exportMd";

export const GET = guarded(null, async ({ req, user }) => {
  if (await needsAgreement(user)) throw new HttpError(403, "Please sign the Student Agreement first.");
  const lessonId = new URL(req.url).searchParams.get("lesson");
  const [all, cohortYear] = await Promise.all([listLessons(), getCohortYear()]);
  // the same lessons the Lessons page shows this person
  let lessons = user.role === "superAdmin" ? all : all.filter((l) => l.studentVisible);
  if (lessonId) {
    lessons = lessons.filter((l) => l.id === lessonId);
    if (!lessons.length) throw new HttpError(404, "Lesson not found.");
  }
  const submissions = user.role === "student" ? await listSubmissions({ studentId: user.id }) : [];
  return new Response(exportMarkdown({ user, lessons, submissions, cohortYear }), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(lessons, Boolean(lessonId))}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
