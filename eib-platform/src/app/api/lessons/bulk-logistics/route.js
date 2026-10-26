// Super admin: set the session values on every lesson in one go. Student
// fields (room, start, end) go on every lesson; mentor fields go on the
// lessons flagged "Yes Mentor". Any field left blank in the request is left
// alone. Dates are never touched. Returns how many lessons changed.
import { guarded, readJson } from "@/lib/auth";
import { bulkSessionDefaults } from "@/lib/data/lessons";

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const result = await bulkSessionDefaults({ student: body.student || {}, mentor: body.mentor || {} });
  return Response.json(result);
});
