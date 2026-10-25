// Super admin only: turn an unfinished application into a submitted one, as
// if the applicant had pressed Submit with what they have. Skips the window,
// domain and required-field checks (those protect the public form; this is
// a deliberate staff action). The result is an ordinary pending application
// in EIB Students; the usual interview / approve / release steps follow.
import { guarded, HttpError } from "@/lib/auth";
import { getDraft, deleteDraft } from "@/lib/data/drafts";
import { getApplicationForm } from "@/lib/data/settings";
import { createApplication, findApplicationByEmail } from "@/lib/data/applications";

export const POST = guarded(["superAdmin"], async ({ params }) => {
  const draft = await getDraft(params.id);
  if (!draft) throw new HttpError(404, "Draft not found.");
  if (await findApplicationByEmail(draft.email)) throw new HttpError(409, `${draft.email} already has a submitted application.`);
  const form = await getApplicationForm();
  const answerFor = (q) => (draft.answers || []).find((a) => a.questionId === q.id)?.answer ?? "";
  const created = await createApplication({
    name: draft.name,
    email: draft.email,
    answers: form.map((q) => ({ questionId: q.id, answer: answerFor(q) })),
  });
  await deleteDraft(draft.id);
  return Response.json(created, { status: 201 });
});
