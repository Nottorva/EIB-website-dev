// Public but sign-in required: a signed-in student presses Sign up. There
// are no questions. Enforced here, regardless of what the page shows:
//   - sign-up must be open
//   - the student's email must be on the school domain
//   - one sign-up per email
//   - there must be room: a free seat, or a free spot on the waitlist
// First come, first served: the answer says where they landed.
import { open, HttpError } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { getApplicationWindow, windowState } from "@/lib/data/settings";
import { createApplication, findApplicationByEmail, getSeats } from "@/lib/data/applications";
import { deleteDraftByEmail } from "@/lib/data/drafts";

export const POST = open(async () => {
  const applicant = await getApplicant();
  if (!applicant) throw new HttpError(401, "Sign in with your school account to sign up.");

  const win = await getApplicationWindow();
  const state = windowState(win);
  if (state === "upcoming") throw new HttpError(403, "Sign-up is not open yet.");
  if (state === "closed") throw new HttpError(403, "Sign-up has closed.");
  if (!emailOnDomain(applicant.email, win.applicantDomain)) throw new HttpError(403, `Signing up requires an @${win.applicantDomain} account.`);
  if (await findApplicationByEmail(applicant.email)) throw new HttpError(409, "This account is already signed up.");
  if ((await getSeats()).full) throw new HttpError(409, "The class and the waitlist are both full.");

  const created = await createApplication({ name: applicant.name, email: applicant.email, answers: [] });
  await deleteDraftByEmail(applicant.email);
  return Response.json({ ok: true, id: created.id, placed: created.status === "approved" ? "class" : "waitlist", waitlistPosition: created.waitlistPosition || null }, { status: 201 });
});
