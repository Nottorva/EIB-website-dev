// A parent or guardian signs their child up without the student being there.
//
// They give their own name and email and the student's name and school
// email. Nothing is held yet: they are emailed a link, and the seat is taken
// the moment that link is first opened (first come, first served, same as a
// student pressing Sign up). The same link then lets them read and sign the
// Student Agreement on their own and see how to pay; their signature alone
// completes the agreement, because the link proved their email address.
//
//   parent_signups  { id, parentName, parentEmail, studentName, studentEmail,
//                     tokenHash, createdAt, lastSentAt, expiresAt,
//                     applicationId (set once the link has been opened) }

import { createHash, randomBytes } from "node:crypto";
import { findOneBy, insert, updateOne, removeOne, newId } from "./store";
import { getApplicationWindow, windowState } from "./settings";
import { createApplication, findApplicationByEmail, getApplication, getSeats, waitlistPosition, isInClass } from "./applications";
import { sendEmail } from "../mailer";

const COLLECTION = "parent_signups";
const LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // the link keeps working for 30 days
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // one email every two minutes per student

const hash = (t) => createHash("sha256").update(t).digest("hex");
const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const fail = (status, message) => Object.assign(new Error(message), { status });
const isEmail = (v) => /^\S+@\S+\.\S+$/.test(v);
const onDomain = (email, domain) => !domain || email.slice(email.lastIndexOf("@") + 1) === String(domain).toLowerCase();
export const maskEmail = (email) => {
  const at = String(email || "").indexOf("@");
  return at > 1 ? `${email[0]}…${email.slice(at)}` : String(email || "");
};
const linkFor = (origin, token) => `${origin || "https://www.joineib.ca"}/parent?token=${token}`;

// Step one: check the details and email the parent their link.
export async function requestParentSignup(input, { origin } = {}) {
  const parentName = clean(input?.parentName, 120);
  const parentEmail = clean(input?.parentEmail, 160).toLowerCase();
  const studentName = clean(input?.studentName, 120);
  const studentEmail = clean(input?.studentEmail, 160).toLowerCase();
  if (parentName.length < 2) throw fail(400, "Please enter your name.");
  if (!isEmail(parentEmail)) throw fail(400, "Please enter a valid email address for yourself.");
  if (studentName.length < 2) throw fail(400, "Please enter the student's name.");
  if (!isEmail(studentEmail)) throw fail(400, "Please enter the student's school email address.");

  const win = await getApplicationWindow();
  const state = windowState(win);
  if (state === "upcoming") throw fail(403, "Sign-up is not open yet.");
  if (state === "closed") throw fail(403, "Sign-up has closed.");
  if (!onDomain(studentEmail, win.applicantDomain)) throw fail(400, `The student's email must be their @${win.applicantDomain} school address.`);
  if (parentEmail === studentEmail) throw fail(400, "Please use your own email address, not the student's.");
  if (await findApplicationByEmail(studentEmail)) throw fail(409, "This student is already signed up. Their Student Agreement is signed from the student's own account.");
  if ((await getSeats()).full) throw fail(409, "The class and the waitlist are both full.");

  const earlier = await findOneBy(COLLECTION, "studentEmail", studentEmail, (d) => d.studentEmail === studentEmail);
  if (earlier) {
    if (earlier.lastSentAt && Date.now() - new Date(earlier.lastSentAt).getTime() < RESEND_COOLDOWN_MS) throw fail(429, "A link was emailed for this student a moment ago. Check the inbox (and the spam folder), or try again in two minutes.");
    await removeOne(COLLECTION, earlier.id);
  }

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const doc = await insert(COLLECTION, {
    id: newId("psu"),
    parentName,
    parentEmail,
    studentName,
    studentEmail,
    tokenHash: hash(token),
    createdAt: now.toISOString(),
    lastSentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LINK_TTL_MS).toISOString(),
    applicationId: null,
  });
  const link = linkFor(origin, token);
  try {
    await sendEmail({
      to: parentEmail,
      subject: `Confirm your email to sign ${studentName} up for EIB`,
      text: [
        `Hello ${parentName},`,
        "",
        `You asked to sign ${studentName} (${studentEmail}) up for EIB. Seats are first come, first served, and the seat is taken the moment you open this link:`,
        link,
        "",
        "The same link then lets you read and sign the Student Agreement and see how to pay the program fee. Keep this email: the link works for 30 days.",
        "",
        "If you did not ask for this, ignore this email; nothing happens unless the link is opened.",
        "",
        "EIB · Entrepreneurship, Innovation & Business",
      ].join("\n"),
    });
  } catch (e) {
    await removeOne(COLLECTION, doc.id);
    throw e;
  }
  return { ok: true, parentEmailMasked: maskEmail(parentEmail) };
}

/** The sign-up behind a link, or null when the link is unknown or too old. */
export async function parentByToken(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) return null;
  const h = hash(String(token));
  const doc = await findOneBy(COLLECTION, "tokenHash", h, (d) => d.tokenHash === h);
  if (!doc || (doc.expiresAt && Date.now() > new Date(doc.expiresAt).getTime())) return null;
  return doc;
}

// The student hears that someone signed them up, so a wrong or unwanted
// sign-up is noticed. A failed email never undoes the seat.
async function tellStudent(doc, app, position, origin) {
  const where = isInClass(app) ? "You have a seat in the class." : `The class is full, so you are number ${position} on the waitlist.`;
  try {
    await sendEmail({
      to: doc.studentEmail,
      subject: "You have been signed up for EIB",
      text: [`Hello ${doc.studentName},`, "", `${doc.parentName} (${doc.parentEmail}) signed you up for EIB as your parent or guardian. ${where}`, "", "Sign in with your school account here:", `${origin || "https://www.joineib.ca"}/apply`, "", "If you did not expect this, tell an EIB student leader.", "", "EIB · Entrepreneurship, Innovation & Business"].join("\n"),
    });
  } catch (e) {
    console.error(`[eib] could not email ${doc.studentEmail} about their parent's sign-up: ${e.message}`);
  }
}

// Step two: the parent opens the link. The first time, this is what takes
// the seat (or the waitlist spot). Every time, it says where things stand:
//   invalid   unknown or expired link
//   removed   EIB removed the sign-up since
//   taken     the student signed up themselves in the meantime
//   full      no seat and no waitlist spot was left
//   waitlist  waiting, with `position`
//   seat      in the class: the agreement and payment come next
export async function openParentLink(token, { origin } = {}) {
  const doc = await parentByToken(token);
  if (!doc) return { state: "invalid" };
  let app = doc.applicationId ? await getApplication(doc.applicationId) : null;
  if (doc.applicationId && !app) return { state: "removed", signup: doc };
  if (!app) {
    if (await findApplicationByEmail(doc.studentEmail)) return { state: "taken", signup: doc };
    try {
      app = await createApplication({ name: doc.studentName, email: doc.studentEmail, answers: [], parent: { name: doc.parentName, email: doc.parentEmail, signupId: doc.id } });
    } catch (e) {
      if (e.status === 409) return { state: "full", signup: doc };
      throw e;
    }
    // someone else's row for this student won the same instant (the student
    // pressing Sign up as this link opened): theirs stands
    if (app.parent?.signupId !== doc.id) return { state: "taken", signup: doc };
    await updateOne(COLLECTION, doc.id, { applicationId: app.id, claimedAt: new Date().toISOString() });
    await tellStudent(doc, app, app.waitlistPosition || null, origin);
  }
  if (isInClass(app)) return { state: "seat", signup: doc, application: app };
  const position = await waitlistPosition(app);
  return position ? { state: "waitlist", signup: doc, application: app, position } : { state: "removed", signup: doc };
}

// A new link for a parent whose child just moved up from the waitlist (the
// old one stops working). Returns the link, or null when there is no sign-up.
export async function freshParentLink(signupId, origin) {
  const token = randomBytes(32).toString("hex");
  const saved = await updateOne(COLLECTION, signupId, { tokenHash: hash(token), expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString() });
  return saved ? linkFor(origin, token) : null;
}

export async function removeParentSignup(signupId) {
  return removeOne(COLLECTION, signupId);
}
