// POST { lessonNumber, cohortYear, assign: true|false }
// Enforces the per-lesson mentor cap per cohort year (409 when full).
import { guarded, readJson, HttpError } from "@/lib/auth";
import { assignLesson } from "@/lib/data/mentors";
import { getCohortYear } from "@/lib/data/settings";

export const POST = guarded(["superAdmin", "studentLeader", "advancement"], async ({ req, params }) => {
  const body = await readJson(req);
  if (body.lessonNumber === undefined) throw new HttpError(400, "lessonNumber is required.");
  const cohortYear = body.cohortYear ?? (await getCohortYear());
  const saved = await assignLesson(params.id, {
    lessonNumber: body.lessonNumber,
    cohortYear,
    assign: body.assign !== false,
  });
  if (!saved) throw new HttpError(404, "Mentor not found.");
  return Response.json(saved);
});
