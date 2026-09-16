// Public. Everything the /apply page needs to decide what to show:
// window state, the applicant (if signed in), whether they already applied,
// and the form questions.
import { open } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { authMode } from "@/lib/auth";
import { getApplicationForm, getApplicationWindow, windowState } from "@/lib/data/settings";
import { findApplicationByEmail } from "@/lib/data/applications";

export const GET = open(async () => {
  const [form, win, applicant] = await Promise.all([getApplicationForm(), getApplicationWindow(), getApplicant()]);
  const existing = applicant ? await findApplicationByEmail(applicant.email) : null;
  return Response.json({
    state: windowState(win),
    opensAt: win.opensAt,
    closesAt: win.closesAt,
    applicantDomain: win.applicantDomain,
    applicant,
    domainOk: applicant ? emailOnDomain(applicant.email, win.applicantDomain) : null,
    authMode,
    alreadyApplied: Boolean(existing),
    appliedAt: existing?.submittedAt || null,
    form,
    now: new Date().toISOString(),
  });
});
