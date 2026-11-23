// `applications` collection: sign-ups, first come, first served.
//
// Whoever submits the form while a seat is free is in the class at once: the
// row is "approved" and their student account is created in the same step.
// Once the class is full (the class size cap), the next people join the
// waitlist ("waitlist"), which has a fixed number of spots; when that is
// full too, nobody else can sign up. A seat that frees up (a student is
// deleted, or the cap is raised) goes to the first person on the waitlist,
// who is emailed.
//
// A parent or guardian can sign their child up too (see parentSignup.js);
// such a row carries `parent: { name, email, signupId }`. `paidAt` is set
// when the super admin ticks the program fee as paid.
//
// Rows from before first come, first served have no `fcfs` flag. The ones
// that were approved are students like any other; the rest (pending,
// interview, waitlist, denied) are kept but take no seat and no waitlist
// spot, and the Student Manager does not list them.

import { findAll, findById, findOneBy, insert, updateOne, newId, removeOne } from "./store";
import { upsertStudent, setSuspended, deleteUser, markWelcomed } from "./users";
import { deleteSubmissionsFor } from "./submissions";
import { deleteAidaFor } from "../aida/store";
import { deleteCredentialFor } from "./credentials";
import { deleteDraftByEmail } from "./drafts";
import { getClassSizeCap, getWaitlistSpots } from "./settings";
import { sendEmail } from "../mailer";

export const APPLICATION_STATUSES = ["pending", "interview", "waitlist", "approved", "denied"];
// Statuses a person can be told about. Pending and interview (old rows only) stay "under review".
export const FINAL_STATUSES = ["approved", "waitlist", "denied"];

const byArrival = (a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)) || String(a.id).localeCompare(String(b.id));

/** Everyone, in order of arrival. */
export async function listApplications() {
  return [...(await findAll("applications"))].sort(byArrival);
}

export const isInClass = (app) => app.status === "approved";
export const isOnWaitlist = (app) => app.status === "waitlist" && app.fcfs === true;

/** Seats and waitlist spots, taken and left. */
export function seatsFrom(apps, cap, waitlistSpots) {
  const seated = apps.filter(isInClass).length;
  const waitlisted = apps.filter(isOnWaitlist).length;
  const seatsLeft = Math.max(0, cap - seated);
  const waitlistLeft = Math.max(0, waitlistSpots - waitlisted);
  return { cap, seated, seatsLeft, waitlistSpots, waitlisted, waitlistLeft, full: seatsLeft === 0 && waitlistLeft === 0 };
}

export async function getSeats() {
  const [apps, cap, spots] = await Promise.all([listApplications(), getClassSizeCap(), getWaitlistSpots()]);
  return seatsFrom(apps, cap, spots);
}

/** 1 for the next person in line; null when the row is not on the waitlist. */
export async function waitlistPosition(app) {
  if (!app || !isOnWaitlist(app)) return null;
  const at = (await listApplications()).filter(isOnWaitlist).findIndex((a) => a.id === app.id);
  return at < 0 ? null : at + 1;
}

export async function getApplication(id) {
  return findById("applications", id);
}

export async function findApplicationByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  return findOneBy("applications", "email", target, (a) => String(a.email).toLowerCase() === target);
}

const fullError = () => Object.assign(new Error("The class and the waitlist are both full."), { status: 409 });

// Into the class: the row is approved and the student account exists (a
// suspended one is switched back on). The account skips the old welcome
// page: a new student goes straight to the Student Agreement.
async function giveSeat(app) {
  const user = await upsertStudent({ name: app.name, email: app.email });
  if (!user.welcomedAt) await markWelcomed(user.id);
  return updateOne("applications", app.id, { status: "approved", studentId: user.id, decisionReleased: true, releasedAt: new Date().toISOString() });
}

// A sign-up. Returns the stored row: "approved" with an account, or
// "waitlist" with `waitlistPosition`. Throws 409 when there is no room.
export async function createApplication({ name, email, answers, parent = null }) {
  const [cap, spots] = await Promise.all([getClassSizeCap(), getWaitlistSpots()]);
  const before = seatsFrom(await listApplications(), cap, spots);
  if (before.full) throw fullError();
  const now = new Date().toISOString();
  const created = await insert("applications", {
    id: newId("app"),
    studentId: null,
    name: String(name || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    answers: Array.isArray(answers) ? answers.map((a) => ({ questionId: String(a.questionId), answer: a.answer ?? "" })) : [],
    status: before.seatsLeft > 0 ? "approved" : "waitlist",
    fcfs: true,
    ...(parent ? { parent: { name: String(parent.name || ""), email: String(parent.email || "").toLowerCase(), signupId: parent.signupId || null } } : {}),
    submittedAt: now,
    decisionReleased: true,
    releasedAt: now,
  });

  // Two people can press Submit in the same instant and both see the last
  // seat (or the last waitlist spot). Looking again once the row is stored
  // settles it the same way for both: the later arrival steps down.
  // The same person twice in the same instant (a double click, or a parent's
  // link opening as the student presses Sign up): the first row stands.
  const twins = (await listApplications()).filter((a) => a.email === created.email);
  if (twins.length > 1 && twins[0].id !== created.id) {
    await removeOne("applications", created.id);
    return twins[0];
  }

  let place = created.status;
  if (place === "approved") {
    const seated = (await listApplications()).filter(isInClass);
    const extra = seated.length - cap;
    if (extra > 0 && seated.filter((a) => a.fcfs).slice(-extra).some((a) => a.id === created.id)) place = "waitlist";
  }
  if (place === "approved") return giveSeat(created);

  if (created.status !== "waitlist") await updateOne("applications", created.id, { status: "waitlist" });
  const line = (await listApplications()).filter(isOnWaitlist);
  const extra = line.length - spots;
  if (extra > 0 && line.slice(-extra).some((a) => a.id === created.id)) {
    await removeOne("applications", created.id);
    throw fullError();
  }
  return { ...created, status: "waitlist", waitlistPosition: line.findIndex((a) => a.id === created.id) + 1 };
}

// Staff move one person. "approved" gives them a seat and an account at once
// (whatever the cap says: this is a deliberate staff action). Any other
// status takes their sign-in away if they had an account.
export async function setStatus(id, status, { origin } = {}) {
  if (!APPLICATION_STATUSES.includes(status)) {
    const err = new Error(`Unknown status "${status}".`);
    err.status = 400;
    throw err;
  }
  const app = await getApplication(id);
  if (!app) return null;
  if (app.status === status && (status !== "approved" || app.studentId)) return app;
  if (status === "approved") {
    const seated = await giveSeat(app);
    if (isOnWaitlist(app)) await tellSeatOpened(app, origin);
    return seated;
  }
  if (app.studentId) await setSuspended(app.studentId, true);
  return updateOne("applications", id, { status, decisionReleased: true, releasedAt: new Date().toISOString() });
}

// The email a waitlisted person gets when they move into the class. A failed
// email never undoes the seat.
async function tellSeatOpened(app, origin) {
  const link = `${origin || "https://www.joineib.ca"}/apply`;
  try {
    await sendEmail({
      to: app.email,
      subject: "A seat opened up: you are in EIB",
      text: [`Hello ${app.name},`, "", "A seat has opened in EIB and it is yours: you have moved from the waitlist into the class.", "", "Sign in with your school account to get started:", link, "", "EIB · Entrepreneurship, Innovation & Business"].join("\n"),
    });
    // the parent who signed them up gets a new link to sign the agreement
    if (app.parent?.signupId) {
      const { freshParentLink } = await import("./parentSignup");
      const parentLink = await freshParentLink(app.parent.signupId, origin);
      if (parentLink) {
        await sendEmail({
          to: app.parent.email,
          subject: `A seat opened up: ${app.name} is in EIB`,
          text: [`Hello ${app.parent.name},`, "", `A seat has opened in EIB and it is ${app.name}'s: they have moved from the waitlist into the class.`, "", "Open this link to read and sign the Student Agreement and see how to pay the program fee (it replaces the link we sent you before):", parentLink, "", "EIB · Entrepreneurship, Innovation & Business"].join("\n"),
        });
      }
    }
  } catch (e) {
    console.error(`[eib] could not email ${app.email} about their seat: ${e.message}`);
  }
}

// While a seat is free and someone is waiting, the first in line moves in.
// Returns the people who moved.
export async function promoteFromWaitlist({ origin } = {}) {
  const promoted = [];
  for (;;) {
    const [apps, cap] = await Promise.all([listApplications(), getClassSizeCap()]);
    const next = apps.find(isOnWaitlist);
    if (!next || apps.filter(isInClass).length >= cap) break;
    await giveSeat(next);
    await tellSeatOpened(next, origin);
    promoted.push({ id: next.id, name: next.name, email: next.email });
  }
  return promoted;
}

// Clean reset (super admin): the sign-up, the student account it created and
// every submission under that account are removed, so the person can sign up
// again from scratch. Nothing is kept. A freed seat goes to the waitlist.
export async function deleteApplicant(id, { origin } = {}) {
  const app = await getApplication(id);
  if (!app) return null;
  const removed = { application: 1, account: 0, submissions: 0, promoted: [] };
  if (app.studentId) {
    removed.submissions = await deleteSubmissionsFor(app.studentId);
    await deleteAidaFor(app.studentId);
    await deleteCredentialFor(app.studentId);
    if (await deleteUser(app.studentId)) removed.account = 1;
  }
  await removeOne("applications", id);
  await deleteDraftByEmail(app.email);
  if (app.parent?.signupId) await removeOne("parent_signups", app.parent.signupId);
  if (isInClass(app)) removed.promoted = await promoteFromWaitlist({ origin });
  return removed;
}

// The program fee, ticked by the super admin once the payment has arrived.
export async function setPaid(id, paid, by = null) {
  const app = await getApplication(id);
  if (!app) return null;
  return updateOne("applications", id, { paidAt: paid ? new Date().toISOString() : null, paidBy: paid ? by : null });
}

// What the person themselves may see.
export function applicantView(app, position = null) {
  if (!app) return null;
  return {
    submittedAt: app.submittedAt,
    decision: app.decisionReleased && FINAL_STATUSES.includes(app.status) ? app.status : null,
    releasedAt: app.decisionReleased ? app.releasedAt : null,
    waitlistPosition: position,
  };
}
