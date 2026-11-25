// Deliverables: when one counts as done, and when it is due.
//
// Nothing here touches the database, so the Lessons page (in the browser) and
// the server (credentials, reminder emails) use the same rules.
//
// Due dates are not typed in anywhere. A lesson's deliverables are due on the
// Thursday after the lesson's date (a lesson held on a Thursday is due the
// Thursday of the following week). A lesson with no date, or a date that
// cannot be read, has no due date. Days are Toronto calendar days, written
// "2026-11-19".

const TZ = "America/Toronto";
const THURSDAY = 4;

const filled = (v) => String(v ?? "").trim() !== "";
const isUrl = (v) => {
  try {
    return ["http:", "https:"].includes(new URL(String(v || "").trim()).protocol);
  } catch {
    return false;
  }
};

// A deliverable is complete when every one of its fields is filled:
//   text       something is written
//   link       a real web address
//   checklist  every box is ticked
//   table      every cell is filled. A table with named rows needs all of
//              them; one where the student adds rows needs at least one row,
//              and a row left entirely blank is ignored.
export function isComplete(d, payload) {
  // a checklist nobody has given any boxes has nothing to fill
  if (d.type === "checklist" && (d.checklistItems || []).length === 0) return true;
  if (!payload) return false;
  if (d.type === "text") return filled(payload.text);
  if (d.type === "link") return isUrl(payload.url);
  if (d.type === "checklist") {
    const done = new Set((payload.items || []).filter((i) => i.checked).map((i) => i.label));
    return d.checklistItems.every((label) => done.has(label));
  }
  if (d.type === "table") {
    const width = ((d.columns || []).length ? d.columns : payload.columns || []).length || 2;
    const whole = (row) => Array.from({ length: width }, (_, c) => row?.[c]).every(filled);
    const rows = payload.rows || [];
    if ((d.rowLabels || []).length) return d.rowLabels.every((_, i) => whole(rows[i]));
    const used = rows.filter((r) => (r || []).some(filled));
    return used.length > 0 && used.every(whole);
  }
  return false;
}

const pad = (n) => String(n).padStart(2, "0");
const asUtc = (day) => new Date(`${day}T12:00:00Z`);

// Today's date in Toronto.
export const todayDay = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: TZ });

// A lesson date as typed in the editor ("Nov 17, 2026", "2026-11-17",
// "November 17") as a calendar day, or "" when it cannot be read. A date typed
// without a year is taken to be in the current year.
export function lessonDay(text, now = new Date()) {
  const s = String(text || "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  // it has to look like a date (a month name or 11/17, and a day number): "TBD" is not one
  if (!/\d/.test(s) || !(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) || /\d\s*[/.-]\s*\d/.test(s))) return "";
  const t = Date.parse(/\b\d{4}\b/.test(s) ? s : `${s}, ${todayDay(now).slice(0, 4)}`);
  if (Number.isNaN(t)) return "";
  // free text is read as local midnight, so the local parts are the day typed
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The day a lesson's deliverables are due: the Thursday after the lesson.
export function dueDay(lesson, now = new Date()) {
  const day = lessonDay(lesson?.date, now);
  if (!day) return "";
  const d = asUtc(day);
  const ahead = (THURSDAY - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + ahead);
  return d.toISOString().slice(0, 10);
}

// Where today sits against a due day: "" (no due date), "upcoming", "today"
// or "past". Work is on time through the end of the due day.
export function dueState(due, now = new Date()) {
  if (!due) return "";
  const today = todayDay(now);
  return today < due ? "upcoming" : today === due ? "today" : "past";
}

// "Thursday, November 19" (or "Thu, Nov 19" when short).
export function formatDue(due, { short = false } = {}) {
  if (!due) return "";
  return asUtc(due).toLocaleDateString("en-CA", { weekday: short ? "short" : "long", month: short ? "short" : "long", day: "numeric", timeZone: "UTC" });
}
