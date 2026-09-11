# EIB Platform — local sandbox

One Next.js app containing all four EIB tools, running against a local JSON
file instead of MongoDB, with a dev role switcher instead of Google OAuth.
The API routes and data shapes are the ones the real deployment will use.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000. The first request creates `data/db.json` from the
seed data. To start over: `npm run db:reset` (or delete `data/db.json`).

## Click-through guide

The amber **Viewing as** dropdown in the top bar picks who you are. It sets a
cookie; every page and every API route looks the email up in `users` and
takes the role from that row. "Stranger" simulates an email that is not on
the allow-list.

| Viewing as | What you can open |
|---|---|
| Josef Marshall (super admin) | Lesson Editor, Mentor CRM, Student Manager (all three tabs), Lessons (leader preview) |
| Jack Harlow (student leader) | Mentor CRM, Student Manager (Forms + Students only), Lessons (leader mode) |
| Amara Chen (student) | Lessons (student mode, own submissions only) |
| Stranger | Nothing except the public application form |

Things worth trying, in order:

1. **Editor → CRM wiring.** In Lesson Editor, flip lesson 3 to "Yes Mentor".
   Open Mentor CRM → any mentor → "Assigned to lessons": lesson 3 now appears.
2. **One mentor per lesson per cohort.** In the CRM, open Marcus Ilunga and
   try to assign Lesson 1. The server rejects it (Trent has it) and the error
   shows at the top of the page. Unassign Trent first, then it works.
3. **Private contacts stay private.** Open Dana Whitfield. Her phone is
   Preferred but Private; her email is Public. Switch to Amara, open Lessons →
   Chapter 2 → Mentor pill: the popup shows the email, never the phone. The
   network response from `/api/lessons/view` contains no `contacts` array.
4. **Submission sync + release.** As Amara, open Chapter 3 → "Prototype
   Reaction Notes" and type a response (it autosaves). Switch to Jack,
   Student Manager → Amara Chen → Deliverables: the text is there. Enter a
   grade and feedback; they are a draft the student cannot see. Click
   **Release to student**. Switch back to Amara: grade and feedback appear.
   "Withdraw from student" hides them again.
5. **Approve creates the account, with a confirmation.** Open the public
   Application form (link in the top bar). Sign in with the sandbox stand-in
   (any name, an @tfs.ca email) and submit. As Jack, Student
   Manager → the new applicant is Pending. Set them to Approved: a popup asks
   you to confirm and shows the class size after approval. Confirm. Refresh:
   they now appear in the "Viewing as" switcher as a student and can open
   Lessons.
6. **Class size cap.** The stats bar at the top of the Students tab shows
   applicants, interviews, and approved / cap. As Josef, "Set max class size"
   changes the cap. As Jack it is read-only.
7. **Leaders edit room and time.** As Jack, open Lessons → "Edit location &
   time" on any lesson card. Changes save as you type and show for students.
   The API only accepts room/start/end from this route; anything else is
   rejected.
8. **Links.** In the Lesson Editor, Student Overview, Slides and Teaching Plan
   each take a link. Students get the first two; the teaching plan link is
   never sent to a student account.
9. **Examples are filled in, not typed.** In the Add/Edit Deliverable modal
   the Example box is the real student widget: tick the checkboxes, fill the
   table, pick a file. Hit Save and that filled-in version is the example
   shown on the editor card, in the leader's Lessons view, and as the
   placeholder in the student's text box. "Preview" on a card is a blank,
   unsaved copy of the widget for trying it out. Table deliverables can name
   their rows as well as their columns.
10. **Application link and window.** Student Manager → Forms. Copy the
    permanent link, then set Opens / Closes. Set Closes to a past time and
    open the link in a new tab: "Applications have closed". Set Opens to a
    future time: "not open yet". Clear both: live. Applicants must sign in
    with the configured email domain, and one application per email is
    enforced server-side.
11. **Acc Manager** (super admin only): create a student leader, refresh, and
    they appear in the switcher.

## Layout

```
src/lib/data/store.js       JSON-file store. Swap this for the Mongo driver.
src/lib/data/*.js           One module per collection; routes call only these.
src/lib/auth.js             getCurrentUser() + role gating. Swap the cookie
                            lookup for NextAuth session lookup.
src/app/api/**              Route handlers, all gated with guarded([roles]).
src/app/api/dev/switch-user DEV ONLY. Delete with the real auth swap.
src/components/*.jsx        The four tools + the apply form (client components).
src/app/*/page.jsx          Thin server pages: gate by role, render the tool.
```

## Deviations from the spec (all deliberate, all small)

- **Public `/apply` route added.** The spec has an `applications` collection
  but nothing that creates rows in it. The Forms tab says "this is what
  applicants see", so the live form exists and posts to `POST /api/apply`.
- **Form questions live in a `settings` map**, not a sixth collection. There
  are no name/email questions: applicants sign in with their school Google
  account and the application takes name and email from that identity.
  Sandbox stand-in: `POST /api/apply/session` (delete with real OAuth).
- **`applicationWindow` setting** (`opensAt`, `closesAt`, `applicantDomain`),
  editable by leaders and super admin. `/apply` is one permanent URL whose
  state (upcoming / open / closed) is derived server-side at request time.
- **Lessons carry `room`, `startTime`, `endTime`, `overview`** because the
  lesson view UI shows them. They are edited in the Editor's Student Overview
  modal.
- **Deliverables carry `columns` + `rowLabels` (table) and `checklistItems`
  (checklist)** so those two types have a real structure for students to
  fill in.
- **Submissions carry `released` / `releasedAt`.** Grade and feedback are a
  leader's draft until released; student-facing routes strip them until then.
- **Lessons carry `overviewLink`, `slidesLink`, `teachingPlanLink`.** The
  teaching plan link is stripped from student responses.
- **Student leaders may PATCH `room` / `startTime` / `endTime`** on a lesson
  (and nothing else). All other lesson writes remain super admin only.
- **`classSizeCap` setting** (default 23), readable by leaders, writable by
  super admin. Approval is not blocked at the cap; the confirmation popup
  warns instead.
- **Approving an email that already has a users row keeps its existing
  role** (name is refreshed). The spec says upsert `{role: "student"}`; a
  literal reading would demote a super admin who applied. Flagging in case
  you want the literal behaviour.
- **Cohort year** is a single setting (`currentCohortYear: 2026`). Mentor
  assignments store it per the spec; lessons and submissions do not (open
  item in the spec, left as is).
- **File uploads are mocked**: only the file name and size are stored, both
  for application uploads and for file deliverables. R2 wiring comes later.
- **Slides** in the lesson view show the link the editor set; the template
  and teaching-plan decks are still the placeholder slide viewer from the
  reference UI.

## Not built (per spec)

- Revoking a student's `users` row when they lose "approved" status.
- Terminus. Its role in the architecture is still unconfirmed.
- Real Google OAuth, MongoDB Atlas, Cloudflare R2.
