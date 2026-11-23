// Public. Everything the /apply page needs to decide what to show:
// window state, how many seats and waitlist spots are left, the applicant (if
// signed in), where their sign-up landed (in the class, or their place on the
// waitlist), whether their account is live or suspended, and the form questions.
import { open, getCurrentUser } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { authMode } from "@/lib/auth";
import { getApplicationWindow, windowState, getClassStarted } from "@/lib/data/settings";
import { findApplicationByEmail, applicantView, getSeats, waitlistPosition } from "@/lib/data/applications";
import { getUserByEmail } from "@/lib/data/users";
import { findDraftByEmail } from "@/lib/data/drafts";

export const GET = open(async () => {
  const [win, applicant, viewer, seats, classStarted] = await Promise.all([getApplicationWindow(), getApplicant(), getCurrentUser(), getSeats(), getClassStarted()]);
  const [existing, row, draft] = applicant ? await Promise.all([findApplicationByEmail(applicant.email), getUserByEmail(applicant.email), findDraftByEmail(applicant.email)]) : [null, null, null];
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
    application: applicantView(existing, await waitlistPosition(existing)),
    seats,
    classStarted,
    account: row ? { role: row.role, suspended: Boolean(row.suspended) } : null,
    // what they typed last time, if they signed in before and did not submit
    draft: draft && !existing ? { answers: draft.answers || [], lastSeenAt: draft.lastSeenAt } : null,
    // signing up is one click: there are no questions
    form: [],
    title: "Sign up for EIB",
    // The super admin can look at the form whatever the window state is,
    // without an applicant sign-in; the page renders a preview that cannot
    // submit. Nobody else gets this flag.
    previewer: viewer?.role === "superAdmin",
    now: new Date().toISOString(),
  });
});
