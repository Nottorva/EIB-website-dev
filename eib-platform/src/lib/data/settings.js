// Small key/value settings: the application form definition and the current
// cohort year. (The spec lists five collections; the form questions need a
// home somewhere, so they live here rather than being hard-coded.)

import { getSetting, setSetting } from "./store";

// "notice" is not a question: a big, bold statement (a fee, a commitment)
// the applicant has to tick to acknowledge before the form will submit.
export const QUESTION_TYPE_IDS = ["short", "long", "choice", "link", "notice"];
export const DEFAULT_ACK = "I understand";

export async function getApplicationForm() {
  return (await getSetting("applicationForm")) || [];
}

export async function saveApplicationForm(questions) {
  const cleaned = (Array.isArray(questions) ? questions : []).map((q) => {
    const type = QUESTION_TYPE_IDS.includes(q.type) ? q.type : q.type === "file" ? "link" : "short";
    return {
      id: String(q.id),
      key: q.key || undefined,
      locked: Boolean(q.locked),
      type,
      label: String(q.label || ""),
      required: Boolean(q.required),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      ...(type === "notice" ? { detail: String(q.detail || ""), ack: String(q.ack || "").trim() || DEFAULT_ACK } : {}),
    };
  });
  // Name and email come from the applicant's signed-in TFS account, never
  // from a question, so any legacy identity questions are dropped on save.
  return setSetting("applicationForm", cleaned.filter((q) => !q.locked && q.key !== "name" && q.key !== "email"));
}

export async function getCohortYear() {
  return (await getSetting("currentCohortYear")) || new Date().getFullYear();
}

export async function getClassSizeCap() {
  const v = await getSetting("classSizeCap");
  return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 23;
}

export async function setClassSizeCap(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) {
    const err = new Error("Class size cap must be a whole number of at least 1.");
    err.status = 400;
    throw err;
  }
  return setSetting("classSizeCap", n);
}

// When the public application link is live. Both bounds are ISO strings or
// null (null = no bound on that side). Applicants must sign in with an email
// on `applicantDomain`.
const DEFAULT_WINDOW = { opensAt: null, closesAt: null, applicantDomain: "tfs.ca" };

export async function getApplicationWindow() {
  return { ...DEFAULT_WINDOW, ...((await getSetting("applicationWindow")) || {}) };
}

function toIsoOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`"${v}" is not a valid date/time.`);
    err.status = 400;
    throw err;
  }
  return d.toISOString();
}

export async function saveApplicationWindow(input) {
  const current = await getApplicationWindow();
  const next = {
    opensAt: "opensAt" in input ? toIsoOrNull(input.opensAt) : current.opensAt,
    closesAt: "closesAt" in input ? toIsoOrNull(input.closesAt) : current.closesAt,
    applicantDomain: "applicantDomain" in input ? String(input.applicantDomain || "").trim().replace(/^@/, "").toLowerCase() : current.applicantDomain,
  };
  if (next.opensAt && next.closesAt && next.opensAt >= next.closesAt) {
    const err = new Error("The close time must be after the open time.");
    err.status = 400;
    throw err;
  }
  return setSetting("applicationWindow", next);
}

// The scrolling strip at the very top of the public site. The application
// status line is generated from the application window; these are the extra
// items after it. Super admin edits them on the Website page.
export const DEFAULT_TICKER = ["Term begins January", "Demo Day in March", "Toronto · London, Ontario", "Now matching ventures with mentors"];

export async function getSiteTicker() {
  const v = await getSetting("siteTicker");
  return Array.isArray(v) ? v : DEFAULT_TICKER;
}

export async function saveSiteTicker(items) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return setSetting("siteTicker", cleaned);
}

// "upcoming" | "open" | "closed"
export function windowState(win, now = new Date()) {
  const t = now.toISOString();
  if (win.opensAt && t < win.opensAt) return "upcoming";
  if (win.closesAt && t >= win.closesAt) return "closed";
  return "open";
}
