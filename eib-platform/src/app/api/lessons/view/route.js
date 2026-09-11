// The student-facing lesson view payload. This is the ONLY route the lesson
// view calls, and it is the one place mentors are reduced to their public
// shape. `contacts[]` never appears in this response.
import { guarded } from "@/lib/auth";
import { listLessons } from "@/lib/data/lessons";
import { listMentors, toPublicMentor } from "@/lib/data/mentors";
import { listSubmissions, stripUnreleased } from "@/lib/data/submissions";
import { getCohortYear } from "@/lib/data/settings";

export const GET = guarded(null, async ({ user }) => {
  const [lessons, mentors, cohortYear] = await Promise.all([listLessons(), listMentors(), getCohortYear()]);

  const withMentor = lessons.map((lesson) => {
    if (!lesson.mentorEnabled) return { ...lesson, mentor: null };
    const owner = mentors.find((m) =>
      m.assignedLessons.some((a) => a.lessonNumber === lesson.number && a.cohortYear === cohortYear)
    );
    return { ...lesson, mentor: toPublicMentor(owner) };
  }).map((lesson) => (user.role === "student" ? { ...lesson, teachingPlanLink: "" } : lesson));

  const mode = user.role === "student" ? "student" : "leader";
  const submissions = mode === "student" ? (await listSubmissions({ studentId: user.id })).map(stripUnreleased) : [];

  return Response.json({ mode, cohortYear, lessons: withMentor, submissions, user: { id: user.id, name: user.name } });
});
