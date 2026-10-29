// The Student Agreement: a PDF the super admin uploads, which every student
// must read to the end and sign (typed initials, plus a parent or legal
// guardian's name, email, relationship and initials) before the Lessons page
// opens for them. Settings hold the metadata and the PDF; each student's
// acceptance is stored on their `users` row as `agreement`.

import { getSetting, setSetting, updateOne, findById } from "./store";

const META_KEY = "studentAgreement";
const PDF_KEY = "studentAgreementPdf";
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
export const RELATIONSHIPS = ["Mother", "Father", "Legal guardian", "Other"];

const DEFAULTS = {
  title: "EIB Student Agreement",
  intro: "Please read the whole agreement. You can download it as a PDF. Once you have reached the end, confirm you have read it, add your initials, and have a parent or legal guardian add theirs.",
  required: true,
  version: 0,
  pdf: null, // { name, size, uploadedAt }
};

export async function getStudentAgreement() {
  const saved = (await getSetting(META_KEY)) || {};
  return { ...DEFAULTS, ...saved };
}

export async function saveStudentAgreement(patch) {
  const current = await getStudentAgreement();
  const next = { ...current };
  if (patch.title !== undefined) next.title = String(patch.title).slice(0, 120) || DEFAULTS.title;
  if (patch.intro !== undefined) next.intro = String(patch.intro).slice(0, 2000);
  if (patch.required !== undefined) next.required = Boolean(patch.required);
  await setSetting(META_KEY, next);
  return next;
}

// Replacing the PDF is a new version: everyone signs again.
export async function saveStudentAgreementPdf({ name, type, data, size }) {
  const current = await getStudentAgreement();
  await setSetting(PDF_KEY, { type: type || "application/pdf", data });
  const next = { ...current, version: (current.version || 0) + 1, pdf: { name: String(name || "student-agreement.pdf"), size: Number(size) || 0, uploadedAt: new Date().toISOString() } };
  await setSetting(META_KEY, next);
  return next;
}

export async function deleteStudentAgreementPdf() {
  const current = await getStudentAgreement();
  await setSetting(PDF_KEY, null);
  const next = { ...current, pdf: null };
  await setSetting(META_KEY, next);
  return next;
}

export async function getStudentAgreementPdf() {
  const doc = await getSetting(PDF_KEY);
  return doc && doc.data ? doc : null;
}

// Does this user still have to sign before seeing lessons?
export function agreementPending(user, meta) {
  if (!user || user.role !== "student") return false;
  if (!meta.required || !meta.pdf) return false;
  return !(user.agreement && user.agreement.version === meta.version);
}

export async function needsAgreement(user) {
  if (!user || user.role !== "student") return false;
  return agreementPending(user, await getStudentAgreement());
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const INITIALS = /^[A-Za-z][A-Za-z.\-' ]{0,9}$/;

// Validates and stores the acceptance. Throws {status:400} style errors via
// the returned `error` so the route can map them.
export async function recordAgreement(user, input) {
  const meta = await getStudentAgreement();
  if (!meta.pdf) return { error: "There is no agreement to sign yet." };
  const read = Boolean(input.readConfirmed);
  const parentConfirmed = Boolean(input.parentConfirmed);
  const studentInitials = clean(input.studentInitials, 10);
  const parentName = clean(input.parentName, 120);
  const parentEmail = clean(input.parentEmail, 160).toLowerCase();
  const parentRelationship = clean(input.parentRelationship, 40);
  const parentInitials = clean(input.parentInitials, 10);
  if (!read) return { error: "Please confirm you have read and understood the agreement." };
  if (!INITIALS.test(studentInitials)) return { error: "Please type your initials (letters only)." };
  if (parentName.length < 2) return { error: "Please enter your parent or legal guardian's full name." };
  if (!/^\S+@\S+\.\S+$/.test(parentEmail)) return { error: "Please enter a valid email address for your parent or legal guardian." };
  if (!RELATIONSHIPS.includes(parentRelationship)) return { error: "Please choose the relationship to you." };
  if (!INITIALS.test(parentInitials)) return { error: "Your parent or legal guardian needs to type their initials." };
  if (!parentConfirmed) return { error: "Your parent or legal guardian must confirm they agree on your behalf." };
  const record = {
    version: meta.version,
    acceptedAt: new Date().toISOString(),
    studentInitials,
    parentName,
    parentEmail,
    parentRelationship,
    parentInitials,
    pdfName: meta.pdf.name,
  };
  const saved = await updateOne("users", user.id, { agreement: record });
  return { record, user: saved };
}

export async function getAgreementFor(userId) {
  const row = await findById("users", userId);
  return row?.agreement || null;
}
