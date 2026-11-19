// AIDA's own records.
//
//   settings "aida"       { mode, dailyLimit, hours, general, prompt }
//   aida_conversations    one document per student per lesson, the messages inside it, fetched by id
//                         (never by scanning: the store filters whole collections in memory)
//   aida_usage            one document per person per Toronto day: messages, tokens, cost

import { findAll, findById, insert, updateOne, removeOne, getSetting, setSetting } from "../data/store";
import { TZ } from "../format";
import { AIDA_MODES, DEFAULT_DAILY_LIMIT, costOf } from "./config";

const now = () => new Date().toISOString();
/** "2026-11-19" in Toronto, whatever the server's clock zone. */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

/* Opening hours: students can use AIDA only on the chosen days between two times, Toronto time.
   days are 0 (Sunday) to 6 (Saturday); times are "HH:MM" on a 24-hour clock. */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_HOURS = { enabled: false, days: [2], start: "16:00", end: "17:30" };
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));
function normalizeHours(h) {
  const days = [...new Set((Array.isArray(h?.days) ? h.days : DEFAULT_HOURS.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const ok = isTime(h?.start) && isTime(h?.end) && h.start < h.end;
  return { enabled: Boolean(h?.enabled), days, start: ok ? h.start : DEFAULT_HOURS.start, end: ok ? h.end : DEFAULT_HOURS.end };
}
const clock = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** "Tuesday, 4:00 PM to 5:30 PM" */
export function hoursText(hours) {
  const days = hours.days.map((d) => DAY_NAMES[d]);
  const list = days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}` : days[0] || "no day";
  return `${list}, ${clock(hours.start)} to ${clock(hours.end)}`;
}
/** Empty when AIDA is open right now; otherwise the sentence a student is shown. */
export function closedNote(settings, at = new Date()) {
  const hours = settings.hours;
  if (!hours?.enabled) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at).map((p) => [p.type, p.value]));
  const now = `${parts.hour}:${parts.minute}`;
  const open = hours.days.includes(DAY_NAMES.indexOf(parts.weekday)) && now >= hours.start && now < hours.end;
  return open ? "" : `AIDA is open ${hoursText(hours)} (Toronto time). It is closed right now.`;
}

export async function getAidaSettings() {
  const s = (await getSetting("aida")) || {};
  return {
    hours: normalizeHours(s.hours),
    mode: AIDA_MODES.includes(s.mode) ? s.mode : "off",
    dailyLimit: Number.isFinite(Number(s.dailyLimit)) && Number(s.dailyLimit) > 0 ? Math.round(Number(s.dailyLimit)) : DEFAULT_DAILY_LIMIT,
    general: String(s.general || ""),
    // "" means the default in prompt.js
    prompt: String(s.prompt || ""),
  };
}

export async function saveAidaSettings(patch) {
  const current = await getAidaSettings();
  const next = { ...current };
  if (patch.mode !== undefined && AIDA_MODES.includes(patch.mode)) next.mode = patch.mode;
  if (patch.dailyLimit !== undefined && Number(patch.dailyLimit) > 0) next.dailyLimit = Math.min(1000, Math.round(Number(patch.dailyLimit)));
  if (patch.hours !== undefined) {
    const h = { ...current.hours, ...patch.hours };
    // times that do not make a window (end before start) leave the saved ones as they were
    const valid = isTime(h.start) && isTime(h.end) && h.start < h.end;
    next.hours = normalizeHours(valid ? h : { ...h, start: current.hours.start, end: current.hours.end });
  }
  if (patch.general !== undefined) next.general = String(patch.general);
  if (patch.prompt !== undefined) next.prompt = String(patch.prompt);
  await setSetting("aida", next);
  return next;
}

/** May this person open AIDA on the Lessons page? */
export function aidaOpenFor(user, settings) {
  if (!user || user.role !== "student") return false;
  return settings.mode === "on" || (settings.mode === "test" && user.isTest === true);
}

/* ---------------------------------------------------------- conversations --- */
const conversationId = (studentId, lessonId) => `aida_${studentId}_${lessonId}`;

export const getConversation = (studentId, lessonId) => findById("aida_conversations", conversationId(studentId, lessonId));

export async function saveConversation(conv) {
  const doc = { ...conv, updatedAt: now() };
  if (await findById("aida_conversations", conv.id)) return updateOne("aida_conversations", conv.id, doc);
  return insert("aida_conversations", doc);
}

export const newConversation = (studentId, lessonId) => ({ id: conversationId(studentId, lessonId), studentId, lessonId, contextKey: "", context: "", sent: {}, messages: [], startedAt: now() });

/** "New chat": the old conversation is kept under another id, out of the way. */
export async function archiveConversation(studentId, lessonId) {
  const conv = await getConversation(studentId, lessonId);
  if (!conv) return false;
  if (conv.messages.length) await insert("aida_conversations", { ...conv, id: `${conv.id}_${Date.now().toString(36)}`, archived: true, archivedAt: now() });
  await removeOne("aida_conversations", conv.id);
  return true;
}

/** Everything AIDA holds about a student, removed with their account (and by the test account's wipe). */
export async function deleteAidaFor(studentId) {
  const mine = await findAll("aida_conversations", (c) => c.studentId === studentId);
  for (const c of mine) await removeOne("aida_conversations", c.id);
  const usage = await findAll("aida_usage", (u) => u.userId === studentId);
  for (const u of usage) await removeOne("aida_usage", u.id);
  return mine.length;
}

/* ------------------------------------------------------------------ usage --- */
const usageId = (userId, day) => `aidause_${userId}_${day}`;

export async function usageToday(userId) {
  return (await findById("aida_usage", usageId(userId, today()))) || { messages: 0, cost: 0 };
}

export async function recordUsage(userId, usage) {
  const day = today();
  const id = usageId(userId, day);
  const cur = await findById("aida_usage", id);
  const add = (k) => (cur?.[k] || 0) + (usage?.[k] || 0);
  const doc = { userId, day, messages: (cur?.messages || 0) + 1, input: add("input"), output: add("output"), cacheRead: add("cacheRead"), cacheWrite: add("cacheWrite"), cost: (cur?.cost || 0) + costOf(usage) };
  return cur ? updateOne("aida_usage", id, doc) : insert("aida_usage", { id, ...doc });
}

/** For the AIDA page: today's and all-time totals across everyone. */
export async function usageSummary() {
  const rows = await findAll("aida_usage");
  const day = today();
  const sum = (list) => ({ messages: list.reduce((n, r) => n + (r.messages || 0), 0), cost: list.reduce((n, r) => n + (r.cost || 0), 0), people: new Set(list.map((r) => r.userId)).size });
  return { today: sum(rows.filter((r) => r.day === day)), total: sum(rows) };
}
