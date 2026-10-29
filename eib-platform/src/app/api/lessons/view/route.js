// The student-facing lesson view payload. This is the ONLY route the lesson
// view calls, and it is the one place mentors are reduced to their public
// shape. `contacts[]` never appears in this response.
import { guarded, HttpError } from "@/lib/auth";
import { listLessons, forStudent } from "@/lib/data/lessons";
import { listMentors, toPublicMentor } from "@/lib/data/mentors";
import { listSubmissions, stripUnreleased } from "@/lib/data/submissions";
import { getCohortYear } from "@/lib/data/settings";
import { needsAgreement } from "@/lib/data/agreement";

export const GET = guarded(null, async ({ user }) => {
  if (await needsAgreement(user)) throw new HttpError(403, "Please sign the Student Agreement first.");
  const [allLessons, mentors, cohortYear] = await Promise.all([listLessons(), listMentors(), getCohortYear()]);
  // Drafts reach the super admin only (shown as drafts); students and
  // student leaders get the published lessons.
  const lessons = user.role === "superAdmin" ? allLessons : allLessons.filter((l) => l.studentVisible);

  const withMentor = lessons.map((lesson) => {
    if (!lesson.mentorEnabled) return { ...lesson, mentor: null };
    const owner = mentors.find((m) =>
      m.assignedLessons.some((a) => a.lessonNumber === lesson.number && a.cohortYear === cohortYear)
    );
    return { ...lesson, mentor: toPublicMentor(owner) };
  }).map((lesson) => (user.role === "student" ? { ...forStudent(lesson), teachingPlanLink: "" } : lesson));

  const mode = user.role === "student" ? "student" : "leader";
  const submissions = mode === "student" ? (await listSubmissions({ studentId: user.id })).map(stripUnreleased) : [];

  return Response.json({ mode, cohortYear, lessons: withMentor, submissions, user: { id: user.id, name: user.name } });
});
