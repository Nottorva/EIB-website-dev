// The Student Agreement: a PDF the super admin uploads, which every student
// must read to the end and sign (typed initials, plus a parent or legal
// guardian's name, email, relationship and initials). The guardian then
// confirms by clicking a single-use link emailed to them; only after that is
// the agreement "signed" and the Lessons page opens. Settings hold the
// metadata and the PDF; each student's record of consent is stored on their
// `users` row as `agreement`.
//
// agreement.status: "pending" (submitted, waiting for the guardian's click)
//                   or "signed" (confirmed). Records from before the email
//                   step have no status and count as pending.

import { createHash, randomBytes } from "node:crypto";
import { getSetting, setSetting, updateOne, findById, findOneBy } from "./store";
import { findApplicationByEmail } from "./applications";
import { getApplicationForm } from "./settings";
import { sendEmail } from "../mailer";
import { AGREEMENT_VERSION_LABEL } from "../agreementText";

const META_KEY = "studentAgreement";
const PDF_KEY = "studentAgreementPdf";
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB
export const RELATIONSHIPS = ["Mother", "Father", "Legal guardian", "Other"];
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // links work for 7 days
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000; // one email every 10 minutes
export const RESEND_DAILY_CAP = 5; // and at most five a day

const DEFAULTS = {
  title: "EIB Student Agreement",
  intro: "Please read the whole agreement. You can download it as a PDF. Once you have reached the end, confirm you have read it, add your initials, and have a parent or legal guardian add theirs. They will get an email to confirm.",
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

/* ---------- status ---------- */

export const isSigned = (rec, meta) => Boolean(rec && rec.status === "signed" && rec.version === meta.version);
export const isPending = (rec, meta) => Boolean(rec && rec.status !== "signed" && rec.version === meta.version);

// Does this user still have to finish signing before seeing lessons?
export function agreementPending(user, meta) {
  if (!user || user.role !== "student") return false;
  if (!meta.required || !meta.pdf) return false;
  return !isSigned(user.agreement, meta);
}

export async function needsAgreement(user) {
  if (!user || user.role !== "student") return false;
  return agreementPending(user, await getStudentAgreement());
}

// What the student (and the admin) may see of a record: never the token.
export function publicRecord(rec) {
  if (!rec) return null;
  const { confirmation, ...rest } = rec;
  const email = rest.parentEmail || "";
  const at = email.indexOf("@");
  return {
    ...rest,
    status: rest.status || "pending",
    parentEmailMasked: at > 1 ? `${email[0]}…${email.slice(at)}` : email,
    lastSentAt: confirmation?.lastSentAt || null,
    sendCount: confirmation?.sendLog?.length || 0,
    canResendAt: confirmation?.lastSentAt ? new Date(new Date(confirmation.lastSentAt).getTime() + RESEND_COOLDOWN_MS).toISOString() : null,
  };
}

/* ---------- signing ---------- */

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const INITIALS = /^[A-Za-z][A-Za-z.\-' ]{0,9}$/;

// The fee acknowledgement given at application, so both can be pulled
// together with the consent record. Null when there is none to link.
async function feeAcknowledgement(email) {
  const app = await findApplicationByEmail(email);
  if (!app) return null;
  const form = await getApplicationForm();
  const q = form.find((x) => x.id === "q_fee") || null;
  const a = (app.answers || []).find((x) => x.questionId === "q_fee");
  if (!a || !String(a.answer || "").trim()) return null;
  return { applicationId: app.id, label: q?.label || "Program fee notice", answer: a.answer, acknowledgedAt: app.submittedAt };
}

// Validates and stores the submission as pending, then emails the guardian.
export async function recordAgreement(user, input, { origin }) {
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
  const now = new Date().toISOString();
  const record = {
    status: "pending",
    version: meta.version,
    versionLabel: AGREEMENT_VERSION_LABEL,
    pdfName: meta.pdf.name,
    studentId: user.id,
    studentInitials,
    studentSignedAt: now,
    parentName,
    parentEmail,
    parentRelationship,
    parentInitials,
    guardianSubmittedAt: now,
    confirmedAt: null,
    acceptedAt: now, // kept for older readers of the record
    feeAcknowledgement: await feeAcknowledgement(user.email),
    confirmation: { tokenHash: null, expiresAt: null, lastSentAt: null, sendLog: [] },
  };
  await updateOne("users", user.id, { agreement: record });
  const sent = await issueConfirmation(user.id, { origin });
  if (sent.error) return { record: publicRecord({ ...record }), warning: sent.error };
  return { record: publicRecord(sent.record) };
}

/* ---------- the guardian's confirmation link ---------- */

const hash = (t) => createHash("sha256").update(t).digest("hex");

// Rate limit: one email per RESEND_COOLDOWN_MS, RESEND_DAILY_CAP per 24h.
function rateLimited(conf) {
  const now = Date.now();
  if (conf.lastSentAt && now - new Date(conf.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(conf.lastSentAt).getTime())) / 60000);
    return `A confirmation email was sent recently. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`;
  }
  const today = (conf.sendLog || []).filter((t) => now - new Date(t).getTime() < 24 * 60 * 60 * 1000);
  if (today.length >= RESEND_DAILY_CAP) return "The daily limit of confirmation emails has been reached. Try again tomorrow.";
  return null;
}

// Makes a fresh single-use token for this user's pending agreement and
// emails the guardian. Returns { record } or { error, status }.
export async function issueConfirmation(userId, { origin, byAdmin = false } = {}) {
  const user = await findById("users", userId);
  const rec = user?.agreement;
  if (!user || !rec) return { error: "There is no agreement to confirm.", status: 404 };
  if (rec.status === "signed") return { error: "This agreement is already confirmed.", status: 409 };
  const conf = { tokenHash: null, expiresAt: null, lastSentAt: null, sendLog: [], ...(rec.confirmation || {}) };
  const limited = rateLimited(conf);
  if (limited && !byAdmin) return { error: limited, status: 429 };
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const next = {
    ...rec,
    status: "pending",
    confirmation: {
      tokenHash: hash(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
      lastSentAt: now.toISOString(),
      sendLog: [...(conf.sendLog || []).filter((t) => now.getTime() - new Date(t).getTime() < 24 * 60 * 60 * 1000), now.toISOString()],
    },
  };
  const link = `${origin}/api/agreement/confirm?token=${token}`;
  const meta = await getStudentAgreement();
  try {
    await sendEmail({
      to: rec.parentEmail,
      subject: `Please confirm: ${meta.title} for ${user.name}`,
      text: [
        `Hello ${rec.parentName},`,
        "",
        `${user.name} has signed the ${meta.title} (version ${AGREEMENT_VERSION_LABEL}) on the EIB platform and named you as their ${rec.parentRelationship.toLowerCase()}. You typed your initials (${rec.parentInitials}) to agree on their behalf.`,
        "",
        "To complete the signature, please confirm by opening this link:",
        link,
        "",
        "The link works once and expires in 7 days. If it has expired, the page will offer to send a new one.",
        "",
        "If you did not expect this email, you can ignore it; nothing happens unless the link is opened.",
        "",
        "EIB · Entrepreneurship, Innovation & Business",
      ].join("\n"),
      html: `<p>Hello ${esc(rec.parentName)},</p>
<p>${esc(user.name)} has signed the ${esc(meta.title)} (version ${AGREEMENT_VERSION_LABEL}) on the EIB platform and named you as their ${esc(rec.parentRelationship.toLowerCase())}. You typed your initials (${esc(rec.parentInitials)}) to agree on their behalf.</p>
<p>To complete the signature, please confirm by clicking this button:</p>
<p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none">Confirm the agreement</a></p>
<p style="color:#64748b;font-size:13px">Or open this link: ${link}<br>The link works once and expires in 7 days. If it has expired, the page will offer to send a new one.</p>
<p style="color:#64748b;font-size:13px">If you did not expect this email, you can ignore it; nothing happens unless the link is opened.</p>
<p>EIB · Entrepreneurship, Innovation &amp; Business</p>`,
    });
  } catch (e) {
    return { error: e.message, status: e.status || 502 };
  }
  await updateOne("users", userId, { agreement: next });
  return { record: next };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function userByToken(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const h = hash(token);
  return findOneBy("users", "agreement.confirmation.tokenHash", h, (u) => u.agreement?.confirmation?.tokenHash === h);
}

// The guardian clicked. Returns { state: "ok" | "used" | "expired" | "invalid", user? }.
export async function confirmAgreement(token) {
  const user = await userByToken(token);
  if (!user) return { state: "invalid" };
  const rec = user.agreement;
  if (rec.status === "signed") return { state: "used", user };
  if (!rec.confirmation?.expiresAt || Date.now() > new Date(rec.confirmation.expiresAt).getTime()) return { state: "expired", user };
  const now = new Date().toISOString();
  // the hash stays so a second click can say "already confirmed"; the
  // signed status makes the token inert
  const next = { ...rec, status: "signed", confirmedAt: now, confirmation: { ...rec.confirmation, usedAt: now } };
  await updateOne("users", user.id, { agreement: next });
  return { state: "ok", user: { ...user, agreement: next } };
}

// From an expired link: send a fresh one to the same guardian (rate limited).
export async function resendFromToken(token, { origin }) {
  const user = await userByToken(token);
  if (!user) return { error: "This link is not recognised.", status: 404 };
  return issueConfirmation(user.id, { origin });
}

// Sandbox only: make the current link expired, so the expired path can be tested.
export async function expireConfirmationForTest(userId) {
  const user = await findById("users", userId);
  if (!user?.agreement?.confirmation) return null;
  const next = { ...user.agreement, confirmation: { ...user.agreement.confirmation, expiresAt: new Date(Date.now() - 1000).toISOString() } };
  await updateOne("users", userId, { agreement: next });
  return publicRecord(next);
}
