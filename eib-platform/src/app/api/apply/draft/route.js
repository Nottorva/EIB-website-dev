// Public but sign-in required: the application form saves the applicant's
// answers as they type, so an unfinished application is visible to the
// Student Manager and the applicant can come back to it. Same gates as
// submitting, minus the required-field checks.
import { open, readJson, HttpError } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { getApplicationWindow, windowState } from "@/lib/data/settings";
import { findApplicationByEmail } from "@/lib/data/applications";
import { touchDraft } from "@/lib/data/drafts";

export const POST = open(async ({ req }) => {
  const applicant = await getApplicant();
  if (!applicant) throw new HttpError(401, "Sign in with your school account first.");
  const win = await getApplicationWindow();
  if (windowState(win) !== "open") throw new HttpError(403, "Applications are not open.");
  if (!emailOnDomain(applicant.email, win.applicantDomain)) throw new HttpError(403, `Applications require an @${win.applicantDomain} account.`);
  if (await findApplicationByEmail(applicant.email)) throw new HttpError(409, "This application has already been submitted.");

  const body = await readJson(req);
  const saved = await touchDraft({ name: applicant.name, email: applicant.email, answers: body.answers });
  return Response.json({ ok: true, lastSeenAt: saved.lastSeenAt });
});
