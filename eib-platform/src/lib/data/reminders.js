// Reminder emails for deliverables that are past due.
//
// A lesson's deliverables are due the Thursday after the lesson (see
// lib/deliverables.js). Once that Thursday has passed, a student who still
// has an empty field in any of them is emailed. The email lists everything
// of theirs that is past due, chapter by chapter, so a student two weeks
// behind hears about both weeks in one message, and its subject and opening
// line say which chapters and whether all or only some of each is missing.
// Nothing is sent for work that is finished, or not yet past its due date.
//
// Automatic sending is off until the super admin switches it on (Student
// Manager > Reminders); it then runs once a day from /api/reminders/cron.
// A student is emailed when a chapter of theirs first becomes past due (each
// email is written to the `deliverable_reminders` collection, so the same
// chapter never triggers a second automatic email). "Send now" on that tab
// emails everyone with past-due work, whether or not they were told before.
//
//   settings "deliverableReminders"   { enabled }
//   deliverable_reminders             { id, studentId, lessonId, kind: "past", sentAt, manual }

import { findAll, insert, newId, getSetting, setSetting } from "./store";
import { listUsers } from "./users";
import { listLessons } from "./lessons";
import { listSubmissions } from "./submissions";
import { isComplete, dueDay, dueState, formatDue } from "../deliverables";
import { sendEmail } from "../mailer";

const SITE = "https://www.joineib.ca";

export async function getReminderSettings() {
  const s = (await getSetting("deliverableReminders")) || {};
  return { enabled: Boolean(s.enabled) };
}

export async function saveReminderSettings(patch) {
  const next = await getReminderSettings();
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  await setSetting("deliverableReminders", next);
  return next;
}

const joined = (parts) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`);

// The email itself. `items` are the student's unfinished, past-due deliverables:
// { lessonId, chapter: "Chapter 1", short: "1A", title, due: "2026-11-19", of: how many the chapter has }.
// "Your Chapter 1 deliverables" when everything in the chapters named is missing,
// "Some Chapter 1 deliverables" when part of it has been done.
export function reminderEmail(student, items, origin = SITE) {
  const first = String(student.name || "").trim().split(/\s+/)[0] || "there";
  const chapters = [];
  for (const it of items) {
    let c = chapters.find((x) => x.lessonId === it.lessonId);
    if (!c) chapters.push((c = { lessonId: it.lessonId, name: it.chapter, due: it.due, of: it.of, items: [] }));
    c.items.push(it);
  }
  const all = chapters.every((c) => c.items.length >= c.of);
  const subject = `${all ? "Your" : "Some"} ${joined(chapters.map((c) => c.name))} deliverables are still outstanding`;
  const list = (c) => c.items.map((it) => `- ${it.short} ${it.title}`);
  const body =
    chapters.length === 1
      ? [`${subject}:`, "", ...list(chapters[0]), "", `They were due ${formatDue(chapters[0].due)}.`]
      : [`${subject}:`, ...chapters.flatMap((c) => ["", `${c.name} (due ${formatDue(c.due)})`, ...list(c)])];
  const text = [
    `Hi ${first},`,
    "",
    ...body,
    "",
    "Not completing deliverables before Thursday will result in a loss of feedback. Not completing deliverables before the end of the course will result in a loss of credential.",
    "",
    `Finish them here: ${origin}/lessons`,
    "",
    "EIB",
  ].join("\n");
  return { subject, text };
}

// Who has unfinished work that is past due, and what: every deliverable with
// an empty field in a published lesson whose Thursday has passed.
// With `onlyNew`, a student is left out unless one of those chapters is one
// they have not been emailed about yet; the email still lists all of them.
export async function reminderPlan({ now = new Date(), onlyNew = false } = {}) {
  const [users, lessons, submissions, sent] = await Promise.all([listUsers({ role: "student" }), listLessons(), listSubmissions(), findAll("deliverable_reminders")]);
  const pastLessons = lessons
    .filter((l) => l.studentVisible)
    .map((l) => ({ lesson: l, due: dueDay(l, now) }))
    .filter((x) => dueState(x.due, now) === "past")
    .sort((a, b) => a.lesson.number - b.lesson.number);
  const already = new Set(sent.filter((r) => r.kind === "past").map((r) => `${r.studentId}|${r.lessonId}`));
  const plan = [];
  for (const u of users) {
    if (u.suspended || !u.email) continue;
    const payloads = Object.fromEntries(submissions.filter((s) => s.studentId === u.id).map((s) => [s.deliverableId, s.payload]));
    const items = [];
    for (const { lesson, due } of pastLessons) {
      lesson.deliverables.forEach((d, i) => {
        if (!isComplete(d, payloads[d.id])) items.push({ lessonId: lesson.id, chapter: lesson.chapterLabel || `Lesson ${lesson.number}`, id: d.id, short: `${lesson.number}${String.fromCharCode(65 + i)}`, title: d.title, kind: "past", due, of: lesson.deliverables.length });
      });
    }
    if (!items.length) continue;
    if (onlyNew && items.every((it) => already.has(`${u.id}|${it.lessonId}`))) continue;
    plan.push({ student: { id: u.id, name: u.name, email: u.email }, items });
  }
  return plan.sort((a, b) => a.student.name.localeCompare(b.student.name));
}

// Send the emails for a plan and record each one. A failure for one student
// does not stop the rest.
export async function sendReminders({ now = new Date(), manual = false, origin = SITE } = {}) {
  const plan = await reminderPlan({ now, onlyNew: !manual });
  const sent = [];
  const failed = [];
  for (const { student, items } of plan) {
    try {
      await sendEmail({ to: student.email, ...reminderEmail(student, items, origin) });
      for (const lessonId of new Set(items.map((it) => it.lessonId))) {
        await insert("deliverable_reminders", { id: newId("rem"), studentId: student.id, lessonId, kind: "past", sentAt: now.toISOString(), manual });
      }
      sent.push({ name: student.name, deliverables: items.map((it) => it.short) });
    } catch (e) {
      console.error(`[eib reminders] could not email ${student.email}`, e);
      failed.push({ name: student.name, error: e.message });
    }
  }
  return { sent, failed };
}

// The most recent reminders, newest first: one line per email.
export async function recentReminders(limit = 12) {
  const [rows, users] = await Promise.all([findAll("deliverable_reminders"), listUsers({ role: "student" })]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const emails = new Map();
  for (const r of rows) {
    const key = `${r.studentId}|${r.sentAt}`;
    if (!emails.has(key)) emails.set(key, { name: names[r.studentId] || "A former student", sentAt: r.sentAt, manual: Boolean(r.manual) });
  }
  return [...emails.values()].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt))).slice(0, limit);
}
