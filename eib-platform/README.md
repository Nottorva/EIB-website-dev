# EIB Platform — local sandbox

One Next.js app containing all four EIB tools, running against a local JSON
file instead of MongoDB, with a URL-based role switch instead of Google OAuth.
The API routes and data shapes are the ones the real deployment will use.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000. The first request creates `data/db.json` from the
seed data. To start over: `npm run db:reset` (or delete `data/db.json`).

`/` is the public website (see "Public site" below). The platform tools start
at `/platform`.

## Click-through guide

Who you are is decided the same way in every mode: your email is looked up
in the `users` allow-list and the role comes from that row. With Google
sign-in configured (see "Going live") that email comes from Google. In the
local sandbox there is no sign-in screen; you start as the seeded super admin
and can switch by visiting a URL (bookmark these):

```
http://localhost:3000/api/dev/switch-user?email=josefm2173@gmail.com   super admin (Josef)
http://localhost:3000/api/dev/switch-user?email=jack.harlow@tfs.ca     student leader (Jack)
http://localhost:3000/api/dev/switch-user?email=amara.chen@tfs.ca      student (Amara)
http://localhost:3000/api/dev/switch-user?email=__stranger__           not on the allow-list
```

That URL only exists in local development; it is disabled in production
builds and whenever Google sign-in is on.

| Signed in as | What you can open |
|---|---|
| Josef Marshall (super admin) | Lesson Editor, Mentor CRM, Student Manager (all three tabs), Lessons (leader preview) |
| Jack Harlow (student leader) | Mentor CRM, Student Manager (Forms + Students only), Lessons (leader mode) |
| Amara Chen (student) | Lessons (student mode, own submissions only) |
| Not on the allow-list | Nothing except the public application form |

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
   switch to them with the dev URL above (their email) and they can open
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
   table, paste a link. Hit Save and that filled-in version is the example
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
11. **Acc Manager** (super admin only): create a student leader; switching to
    their email with the dev URL now works.

## Public site

`/` is the marketing page ported from the design handoff: the pinned photo
reel, the white card that rides up over it, the testimonials carousel and the
curriculum drawn as a commit graph. All of it is scroll-driven and written to
the DOM in `requestAnimationFrame`; nothing about scroll position lives in
React state (see `src/components/site/`). What comes from the database:

| On the site | Comes from |
|---|---|
| Ticker strip | First item is generated from the application window (open until / opens on / closed); the rest are edited on the **Website** page (super admin). |
| Sign in / Apply now | Google sign-in and `/apply`. A signed-in user sees their name and "Open the platform" instead. |
| Curriculum | Lessons the Lesson Editor marks **Website · shown**, in number order, with their stage, week and public description. Consecutive lessons with the same stage share one tag. Until any lesson is shown, the prototype's sample curriculum is displayed. Links, deliverables and rooms never reach the site. |
| Testimonials | The `testimonials` collection, approved rows only, managed on the Website page. With none approved the site shows bracketed placeholder cards labelled as such. Never invent quotes. |
| Reel captions, comparison table, footer | Static copy in `src/lib/siteContent.js`. |
| Photographs | `public/site/stage-*.jpg` are real cohort photos (the auditorium shot doubles as the hero and the Demo Day panel, cropped differently). Each panel in `siteContent.js` names its crop (`position`, `mobilePosition`, `size`) and a `shade` for extra darkening under the caption; the caption also carries a feathered blur of the photo behind it. Carousel photos `v-*.jpg` are still placeholders. |

The prototype's Tune panel was removed; its final values are constants at the
top of `Reel.jsx`. The three typefaces are self-hosted through `next/font`.

## Layout

```
src/app/(site)/             The public site: page, layout, site.css.
src/app/(platform)/         The tools, all behind the top bar. /platform is the hub.
src/components/site/        Reel, SiteChrome, Voices, Curriculum (client, rAF-driven).
src/lib/siteContent.js      Static site copy + fallbacks.
src/lib/data/store.js       JSON-file store. Swap this for the Mongo driver.
src/lib/data/*.js           One module per collection; routes call only these.
src/lib/auth.js             getCurrentUser() + role gating. Swap the cookie
                            lookup for NextAuth session lookup.
src/app/api/**              Route handlers, all gated with guarded([roles]).
src/app/api/dev/switch-user LOCAL DEV ONLY (404 in production / with Google on).
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
- **Slides** in the lesson view show the link the editor set; the template
  and teaching-plan decks are still the placeholder slide viewer from the
  reference UI.

## Going live (Vercel + MongoDB Atlas + Google sign-in)

The app switches from sandbox stand-ins to the real services purely by
environment variables. Nothing else changes. See `.env.example` for the full
list; each group is independent.

| Sandbox stand-in | Real service | Turned on by |
|---|---|---|
| `data/db.json` file store | MongoDB Atlas | `MONGODB_URI` (+ `MONGODB_DB`) |
| URL-based dev role switch | Google sign-in via NextAuth | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` |

### 1. Vercel project settings

The app lives in `eib-platform/`, not the repo root, so Vercel must be told:

- **Settings → General → Root Directory** = `eib-platform` (this fixes the
  "No Output Directory named public" error; without it Vercel doesn't see a
  Next.js app and assumes a static site).
- Framework preset: Next.js (auto-detected once the root directory is right).
- Add every variable from `.env.example` under **Settings → Environment
  Variables**, then redeploy.

### 2. MongoDB Atlas

Create a free cluster, a database user, and allow network access from
anywhere (Vercel has no fixed IP). Paste the connection string as
`MONGODB_URI`. On the first request against an empty database the app creates:
the super admin (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_NAME`), the default
application form, and program settings. Nothing else. Set
`SEED_SAMPLE_DATA=true` only on a staging project if you want the sandbox
sample students, mentors and lessons.

### 3. Google sign-in

In Google Cloud Console → APIs & Services → Credentials → Create OAuth client
ID (Web application). Authorised redirect URIs:

```
https://<your-vercel-domain>/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`,
and set `AUTH_SECRET` to a long random string. Once these are set:

- `/signin` shows a Google button; the dev role-switch URL returns 404.
- Staff and students must be on the `users` allow-list (super admin from env,
  leaders via Acc Manager, students via approval). Anyone else lands on
  "No access" with a sign-out button.
- Applicants use the same Google button on `/apply` but need no allow-list
  row; they must be on the domain set in the Forms tab (default `tfs.ca`).

### Files: links, not uploads

There is no file upload anywhere. Deliverables and application questions of
type **Link** take a URL (Google Docs, Slides, Drive, Canva, a website) and
the student is reminded to share it so anyone with the link can view. This
keeps the platform free of storage costs and permission headaches; work
lives where students already make it. Photos and other assets for the site
itself belong in `public/` and ship with the code.

### Checking a deployment

Open `/api/health` on the deployed site. It reports which backend each part
is using and whether the database answers, without exposing any data:

```json
{ "ok": true, "store": "mongo", "auth": "google", "db": { "ok": true, "users": 1 } }
```

`store: "file"` means `MONGODB_URI` is not being picked up; `db.ok: false`
includes the driver's error message (bad password, network access, etc.).

### Running the real stack locally

Copy `.env.example` to `.env.local`, fill in whichever groups you want, and
`npm run dev`. Any group left blank stays in sandbox mode, so you can test
Google sign-in against the JSON file store, or Atlas with the dev role-switch URL.

## Not built (per spec)

- Revoking a student's `users` row when they lose "approved" status.
- Terminus. Its role in the architecture is still unconfirmed.
- Cloudflare R2 (dropped: links replaced uploads).
