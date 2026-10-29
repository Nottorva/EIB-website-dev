// Dates as the platform shows them: Canadian English, Toronto time, so the
// same timestamp reads the same on a phone, on a laptop and on the server.
// Every helper returns "" (or the given fallback) for a missing value.

const TZ = "America/Toronto";
const LOCALE = "en-CA";

const d = (v) => {
  if (!v) return null;
  const x = v instanceof Date ? v : new Date(v);
  return Number.isNaN(x.getTime()) ? null : x;
};

// "Oct 29, 2026"
export const fmtDate = (v, fallback = "") => d(v)?.toLocaleDateString(LOCALE, { dateStyle: "medium", timeZone: TZ }) ?? fallback;
// "Oct 29, 2026, 4:12 p.m."
export const fmtDateTime = (v, fallback = "") => d(v)?.toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) ?? fallback;
// "Oct 29, 4:12 p.m." (within a list, the year is noise)
export const fmtShortDateTime = (v, fallback = "") => d(v)?.toLocaleString(LOCALE, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }) ?? fallback;
// "October 29"
export const fmtLongDate = (v, fallback = "") => d(v)?.toLocaleDateString(LOCALE, { month: "long", day: "numeric", timeZone: TZ }) ?? fallback;
// "October 29, 2026"
export const fmtLongDateYear = (v, fallback = "") => d(v)?.toLocaleDateString(LOCALE, { month: "long", day: "numeric", year: "numeric", timeZone: TZ }) ?? fallback;
// "October 29, 2026, 4:12 p.m."
export const fmtLongDateTime = (v, fallback = "") => d(v)?.toLocaleString(LOCALE, { dateStyle: "long", timeStyle: "short", timeZone: TZ }) ?? fallback;
// A value that may be a timestamp or a plain date ("2026-09-30"). A plain
// date has no time zone, so it is read as-is (UTC) rather than shifted a day.
export const fmtSmart = (v, fallback = "") =>
  /T/.test(String(v || "")) ? fmtDateTime(v, fallback) : d(v)?.toLocaleDateString(LOCALE, { dateStyle: "medium", timeZone: "UTC" }) ?? fallback;
export const fmtSmartLong = (v, fallback = "") =>
  /T/.test(String(v || "")) ? fmtLongDateTime(v, fallback) : d(v)?.toLocaleDateString(LOCALE, { dateStyle: "long", timeZone: "UTC" }) ?? fallback;
