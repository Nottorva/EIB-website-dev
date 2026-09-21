// Public but sign-in required: a signed-in applicant submits the form.
// Enforced here, regardless of what the page shows:
//   - the application window must be open
//   - the applicant's email must be on the allowed domain
//   - one application per email
import { open, readJson, HttpError } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { getApplicationForm, getApplicationWindow, windowState, DEFAULT_ACK } from "@/lib/data/settings";
import { createApplication, findApplicationByEmail } from "@/lib/data/applications";

export const POST = open(async ({ req }) => {
  const applicant = await getApplicant();
  if (!applicant) throw new HttpError(401, "Sign in with your school account to apply.");

  const win = await getApplicationWindow();
  const state = windowState(win);
  if (state === "upcoming") throw new HttpError(403, "Applications are not open yet.");
  if (state === "closed") throw new HttpError(403, "Applications have closed.");
  if (!emailOnDomain(applicant.email, win.applicantDomain)) throw new HttpError(403, `Applications require an @${win.applicantDomain} account.`);
  if (await findApplicationByEmail(applicant.email)) throw new HttpError(409, "An application from this account has already been received.");

  const body = await readJson(req);
  const form = await getApplicationForm();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const answerFor = (q) => answers.find((a) => a.questionId === q.id)?.answer ?? "";
  for (const q of form) {
    if (q.type === "notice") {
      // the answer to a notice is the acknowledgement text itself, or nothing
      if (q.required && String(answerFor(q)).trim() !== (q.ack || DEFAULT_ACK)) throw new HttpError(400, `Please tick "${q.ack || DEFAULT_ACK}" under "${q.label}" before submitting.`);
      continue;
    }
    if (q.required && String(answerFor(q)).trim() === "") throw new HttpError(400, `"${q.label}" is required.`);
  }

  const created = await createApplication({
    name: applicant.name,
    email: applicant.email,
    answers: form.map((q) => ({ questionId: q.id, answer: answerFor(q) })),
  });
  return Response.json({ ok: true, id: created.id }, { status: 201 });
});
