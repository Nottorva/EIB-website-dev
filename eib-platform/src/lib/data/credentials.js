// `credentials` collection: the EIB Founder Micro-Credential, one per student.
//
// Nothing here is public until the super admin releases it on the Student
// Manager's Graduation tab. A released credential has an unguessable id and a
// public page at /c/<id> that anyone with the link can open. Releasing never
// emails anyone: the student finds the link on their Lessons page.
//
// The student's work is copied into the credential when it is released, so a
// verified credential does not change if they edit an answer afterwards.
// What the super admin chooses (which deliverable is the founder story, which
// deliverables are shown) is read when the page is opened, so un-ticking a
// deliverable takes it off every credential at once.

import { randomBytes } from "crypto";
import { findAll, findById, findOneBy, upsertBy, updateOne, removeOne, getSetting, setSetting } from "./store";
import { listUsers, getUser } from "./users";
import { listLessons } from "./lessons";
import { listSubmissions } from "./submissions";
import { getCohortYear } from "./settings";
import { TZ } from "../format";
import { isComplete } from "../deliverables";

export const CREDENTIAL_TITLE = "EIB Founder Micro-Credential";
export const CREDENTIAL_ISSUER = "EIB by Nemosyne LTD";
export const DEFAULT_CRITERIA =
  "Awarded to a student who completed every deliverable in EIB (Entrepreneurship, Innovation & Business), a venture program taught inside the school timetable. Each deliverable is a piece of the student's own venture, written and submitted by the student.";

const fail = (status, message) => Object.assign(new Error(message), { status });
// "2026–27" from the cohort year, the way the public site writes it.
export const cohortLabel = (year) => `${year}–${String(year + 1).slice(-2)}`;
// "1A", "1B": lesson number plus a letter, the same short names AIDA uses.
const shortName = (lesson, index) => `${lesson.number}${String.fromCharCode(65 + index)}`;

const filled = (v) => String(v ?? "").trim() !== "";

// When a deliverable counts as complete: see lib/deliverables.js (the Lessons
// page and the reminder emails use the same rule).
export { isComplete };

/* ------------------------------------------------------------ settings --- */
// storyDeliverableId  the deliverable shown as the founder story ("" = none)
// hidden              deliverable ids left off the public page
// criteria            the criteria text printed on a credential
export async function getGraduationSettings() {
  const s = (await getSetting("graduation")) || {};
  return {
    storyDeliverableId: String(s.storyDeliverableId || ""),
    hidden: Array.isArray(s.hidden) ? s.hidden.map(String) : [],
    criteria: String(s.criteria || "").trim() || DEFAULT_CRITERIA,
  };
}

export async function saveGraduationSettings(patch) {
  const next = await getGraduationSettings();
  if (patch.storyDeliverableId !== undefined) next.storyDeliverableId = String(patch.storyDeliverableId || "");
  if (patch.hidden !== undefined) next.hidden = Array.isArray(patch.hidden) ? [...new Set(patch.hidden.map(String))] : [];
  if (patch.criteria !== undefined) next.criteria = String(patch.criteria || "").trim().slice(0, 2000) || DEFAULT_CRITERIA;
  await setSetting("graduation", next);
  return next;
}

/* ------------------------------------------------------------ progress --- */
// Every deliverable a student has to complete: the ones in published lessons.
function requiredDeliverables(lessons) {
  return lessons
    .filter((l) => l.studentVisible)
    .flatMap((l) => l.deliverables.map((d, i) => ({ ...d, lessonId: l.id, lessonNumber: l.number, lessonTitle: l.title, short: shortName(l, i) })));
}

function progressOf(required, payloads) {
  const missing = required.filter((d) => !isComplete(d, payloads[d.id]));
  return { done: required.length - missing.length, total: required.length, missing: missing.map((d) => ({ id: d.id, short: d.short, title: d.title })), complete: required.length > 0 && missing.length === 0 };
}

const payloadsOf = (submissions, studentId) => Object.fromEntries(submissions.filter((s) => s.studentId === studentId).map((s) => [s.deliverableId, s.payload]));
const summary = (c) => (c ? { id: c.id, status: c.status, issuedAt: c.issuedAt, revokedAt: c.revokedAt || null } : null);

// Everything the Graduation tab shows.
export async function graduationOverview() {
  const [users, lessons, submissions, credentials, settings, year] = await Promise.all([listUsers({ role: "student" }), listLessons(), listSubmissions(), findAll("credentials"), getGraduationSettings(), getCohortYear()]);
  const required = requiredDeliverables(lessons);
  const byStudent = Object.fromEntries(credentials.map((c) => [c.studentId, c]));
  const students = users
    .filter((u) => !u.suspended)
    .map((u) => ({ id: u.id, name: u.name, ...progressOf(required, payloadsOf(submissions, u.id)), credential: summary(byStudent[u.id]) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    cohort: cohortLabel(year),
    title: CREDENTIAL_TITLE,
    settings,
    deliverables: required.map(({ id, short, title, type, lessonNumber, lessonTitle }) => ({ id, short, title, type, lessonNumber, lessonTitle })),
    students,
    linkedInOrgSet: Boolean(String(process.env.LINKEDIN_ORG_ID || "").trim()),
  };
}

// A table the student adds rows to usually ends in a blank row: leave it off the credential.
const tidy = (d, payload) => (d.type === "table" && !d.rowLabels.length && payload?.rows ? { ...payload, rows: payload.rows.filter((r) => (r || []).some(filled)) } : payload);

/* ------------------------------------------------------- release, revoke --- */
// Issues (or, after a revoke, re-activates) one student's credential. The
// link stays the same when a revoked credential is released again, so
// anything already posted on LinkedIn keeps working.
async function issue(student, required, payloads, { criteria, year }) {
  const now = new Date().toISOString();
  const work = required.map((d) => ({ deliverableId: d.id, short: d.short, lessonNumber: d.lessonNumber, lessonTitle: d.lessonTitle, title: d.title, type: d.type, payload: tidy(d, payloads[d.id]) }));
  return upsertBy(
    "credentials",
    "studentId",
    student.id,
    { id: randomBytes(16).toString("base64url"), studentId: student.id, title: CREDENTIAL_TITLE, issuer: CREDENTIAL_ISSUER, cohort: cohortLabel(year), cohortYear: year, issuedAt: now },
    { studentName: student.name, criteria, deliverables: work, status: "active", revokedAt: null, releasedAt: now }
  );
}

async function releaseContext() {
  const [lessons, submissions, settings, year] = await Promise.all([listLessons(), listSubmissions(), getGraduationSettings(), getCohortYear()]);
  return { required: requiredDeliverables(lessons), submissions, criteria: settings.criteria, year };
}

export async function releaseOne(studentId) {
  const student = await getUser(studentId);
  if (!student || student.role !== "student" || student.suspended) throw fail(404, "That student is not in the class.");
  const existing = await findOneBy("credentials", "studentId", studentId);
  if (existing?.status === "active") throw fail(409, `${student.name} already has an active credential.`);
  const ctx = await releaseContext();
  const payloads = payloadsOf(ctx.submissions, studentId);
  const progress = progressOf(ctx.required, payloads);
  if (!progress.complete) throw fail(409, ctx.required.length ? `${student.name} has completed ${progress.done} of ${progress.total} deliverables. A credential needs all of them.` : "No published lesson has a deliverable yet.");
  return issue(student, ctx.required, payloads, ctx);
}

// Everyone who has completed every deliverable and has no credential yet. A
// student whose credential was revoked is left alone: release them by name.
export async function releaseAll() {
  const [users, credentials, ctx] = await Promise.all([listUsers({ role: "student" }), findAll("credentials"), releaseContext()]);
  const has = new Set(credentials.map((c) => c.studentId));
  const released = [];
  for (const student of users) {
    if (student.suspended || has.has(student.id)) continue;
    const payloads = payloadsOf(ctx.submissions, student.id);
    if (!progressOf(ctx.required, payloads).complete) continue;
    await issue(student, ctx.required, payloads, ctx);
    released.push(student.name);
  }
  return released;
}

export async function revokeOne(studentId) {
  const existing = await findOneBy("credentials", "studentId", studentId);
  if (!existing) throw fail(404, "That student has no credential.");
  if (existing.status === "revoked") return existing;
  return updateOne("credentials", existing.id, { status: "revoked", revokedAt: new Date().toISOString() });
}

// A student who is removed from the platform takes their credential with them.
export async function deleteCredentialFor(studentId) {
  const existing = await findOneBy("credentials", "studentId", studentId);
  return existing ? removeOne("credentials", existing.id) : false;
}

/* ----------------------------------------------------------------- read --- */
// The public page. A revoked credential says only whose it was and that it is
// revoked: none of the student's work.
export async function getPublicCredential(id) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(String(id || ""))) return null;
  const c = await findById("credentials", id);
  if (!c) return null;
  const base = { id: c.id, status: c.status, studentName: c.studentName, title: c.title, issuer: c.issuer, cohort: c.cohort, issuedAt: c.issuedAt };
  if (c.status !== "active") return { ...base, status: "revoked", revokedAt: c.revokedAt };
  const settings = await getGraduationSettings();
  const hidden = new Set(settings.hidden);
  const pub = ({ short, lessonNumber, lessonTitle, title, type, payload }) => ({ short, lessonNumber, lessonTitle, title, type, payload });
  const story = c.deliverables.find((d) => d.deliverableId === settings.storyDeliverableId && !hidden.has(d.deliverableId));
  return {
    ...base,
    criteria: c.criteria,
    story: story ? pub(story) : null,
    deliverables: c.deliverables.filter((d) => !hidden.has(d.deliverableId) && d !== story).map(pub),
  };
}

// The student's own active credential (their Lessons page), or null.
export async function getActiveCredentialFor(studentId) {
  const c = await findOneBy("credentials", "studentId", studentId);
  return c && c.status === "active" ? c : null;
}

/* ------------------------------------------------------------- LinkedIn --- */
// LinkedIn's "add to profile" link. LINKEDIN_ORG_ID is the number of the
// issuer's LinkedIn company page; without it the issuer goes as plain text.
export function linkedInUrl(c, origin) {
  // the year and month it was issued, in Toronto time
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "numeric" }).formatToParts(new Date(c.issuedAt)).map((p) => [p.type, p.value]));
  const [issueYear, issueMonth] = [Number(parts.year), Number(parts.month)];
  const org = String(process.env.LINKEDIN_ORG_ID || "").trim();
  const q = new URLSearchParams({ startTask: "CERTIFICATION_NAME", name: c.title, ...(org ? { organizationId: org } : { organizationName: c.issuer }), issueYear: String(issueYear), issueMonth: String(issueMonth), certUrl: credentialUrl(c, origin), certId: c.id });
  return `https://www.linkedin.com/profile/add?${q}`;
}

export const credentialUrl = (c, origin) => `${origin || "https://www.joineib.ca"}/c/${c.id}`;
