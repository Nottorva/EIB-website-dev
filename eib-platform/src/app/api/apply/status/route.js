// Public. Everything the /apply page needs to decide what to show:
// window state, the applicant (if signed in), their application's status as
// THEY may see it (only released decisions), whether their account is live
// or suspended, and the form questions.
import { open } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { authMode } from "@/lib/auth";
import { getApplicationForm, getApplicationWindow, windowState } from "@/lib/data/settings";
import { findApplicationByEmail, applicantView } from "@/lib/data/applications";
import { getUserByEmail } from "@/lib/data/users";
import { APPLICATION_TITLE } from "@/lib/data/applicationForm2026";

export const GET = open(async () => {
  const [form, win, applicant] = await Promise.all([getApplicationForm(), getApplicationWindow(), getApplicant()]);
  const [existing, row] = applicant ? await Promise.all([findApplicationByEmail(applicant.email), getUserByEmail(applicant.email)]) : [null, null];
  return Response.json({
    state: windowState(win),
    opensAt: win.opensAt,
    closesAt: win.closesAt,
    applicantDomain: win.applicantDomain,
    applicant,
    domainOk: applicant ? emailOnDomain(applicant.email, win.applicantDomain) : null,
    authMode,
    signInAvailable: authMode === "google" || process.env.NODE_ENV !== "production",
    alreadyApplied: Boolean(existing),
    appliedAt: existing?.submittedAt || null,
    application: applicantView(existing),
    account: row ? { role: row.role, suspended: Boolean(row.suspended) } : null,
    form,
    title: APPLICATION_TITLE,
    now: new Date().toISOString(),
  });
});
