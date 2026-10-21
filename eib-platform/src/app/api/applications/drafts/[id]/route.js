import { guarded, HttpError } from "@/lib/auth";
import { deleteDraft } from "@/lib/data/drafts";

// The super admin can clear an unfinished application (the applicant can
// still start again; they just lose the saved answers).
export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const ok = await deleteDraft(params.id);
  if (!ok) throw new HttpError(404, "Draft not found.");
  return Response.json({ ok: true });
});
