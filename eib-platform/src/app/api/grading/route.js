// Everything the Grading tool needs in one read: the class list (names only),
// the lessons that have deliverables, and every submission. Saving a grade
// goes through PUT /api/submissions, the same as the Student Manager.
import { guarded } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";
import { listLessons } from "@/lib/data/lessons";
import { listSubmissions } from "@/lib/data/submissions";

export const GET = guarded(["superAdmin", "studentLeader"], async () => {
  const [users, lessons, submissions] = await Promise.all([listUsers({ role: "student" }), listLessons(), listSubmissions()]);
  // A draft lesson has nothing to grade unless work came in before it was unpublished.
  const hasWork = new Set(submissions.map((s) => s.lessonId));
  return Response.json({
    students: users.filter((u) => !u.suspended).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    lessons: lessons.filter((l) => l.deliverables.length && (l.studentVisible || hasWork.has(l.id))),
    submissions,
  });
});
