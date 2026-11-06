// The write path (verified Josef only): gather fields over email, show the full record, write only after YES,
// and keep one `agentLastChange` snapshot per record for the audit trail. Purely additive: the agent never
// deletes or archives anything; Josef does that by hand in the CRM.

import { readAll, readSetting, writeInsert, writeUpdate, writeSetting, newId } from "./db";
import { cohortYear } from "./tools";
import { mentorSeats } from "../sessionDefaults";
import { MENTOR_STATUSES } from "../data/mentors";
import { normalizeLesson } from "../data/lessons";
import { CRM_URL } from "./style";

const MENTOR_FIELD_HELP = {
  email: "email",
  phone: "phone (optional)",
  linkedin: "LinkedIn (optional)",
  organization: "organization",
  title: "title or role",
  lesson: "lesson number to assign (or 'none')",
  status: `status (${MENTOR_STATUSES.join(", ")})`,
  preferred: "preferred contact method (email, phone or LinkedIn)",
  publicContact: "which contact students may see (email, phone, LinkedIn or none)",
  bio: "student-facing bio, one or two sentences (optional)",
  notes: "notes (optional)",
};
const MENTOR_REQUIRED = ["name", "email"];
const MENTOR_ASK = ["email", "organization", "title", "linkedin", "lesson", "status", "preferred", "publicContact", "bio"];
const METHOD_LABEL = { email: "Email", phone: "Phone", linkedin: "LinkedIn" };
const LESSON_FIELDS = ["date", "startTime", "endTime", "room", "mentorLocation", "mentorStartTime", "mentorEndTime", "mentorBrief", "title"];

const norm = (s) => String(s || "").trim().toLowerCase();

/** Find mentors by name, loosely. */
export async function findMentors(name) {
  const all = await readAll("mentors");
  const n = norm(name);
  if (!n) return [];
  const exact = all.filter((m) => norm(m.name) === n);
  if (exact.length) return exact;
  return all.filter((m) => norm(m.name).includes(n) || n.includes(norm(m.name)));
}

export async function findLessons(ref) {
  const all = await readAll("lessons");
  const r = norm(ref);
  const byNumber = all.filter((l) => String(l.number) === r.replace(/^lesson\s*/, ""));
  if (byNumber.length) return byNumber;
  return all.filter((l) => norm(l.title).includes(r));
}

/** Start or extend a draft. Returns { draft, status: "need_fields" | "ready" | "ambiguous" | "not_found", message }. */
export async function buildDraft({ edit, existingDraft }) {
  const draft = existingDraft ? { ...existingDraft, fields: { ...existingDraft.fields, ...clean(edit.fields) } } : null;
  if (draft) return finish(draft);

  if (edit.target_kind === "mentor") {
    if (edit.action === "create") {
      const name = edit.fields.name || edit.target_name;
      const dupes = await findMentors(name);
      const d = { kind: "mentor", action: "create", targetId: null, targetName: name, fields: clean({ ...edit.fields, name }), createdAt: new Date().toISOString() };
      if (dupes.length) d.note = `There is already a mentor named ${dupes.map((m) => m.name).join(" and ")}. I will add a new record unless you tell me to update that one instead.`;
      return finish(d);
    }
    const matches = await findMentors(edit.target_name);
    if (!matches.length) return { status: "not_found", message: `I could not find a mentor named "${edit.target_name}" in the Mentor CRM.` };
    if (matches.length > 1) return { status: "ambiguous", message: `Which one? I found ${matches.map((m) => `${m.name}${m.publicRole ? ` (${m.publicRole})` : ""}`).join(", ")}.` };
    return finish({ kind: "mentor", action: "update", targetId: matches[0].id, targetName: matches[0].name, fields: clean(edit.fields), createdAt: new Date().toISOString() });
  }
  if (edit.target_kind === "lesson") {
    const matches = await findLessons(edit.target_name);
    if (!matches.length) return { status: "not_found", message: `I could not find lesson "${edit.target_name}".` };
    if (matches.length > 1) return { status: "ambiguous", message: `Which lesson? ${matches.map((l) => `${l.number} (${l.title})`).join(", ")}.` };
    const fields = {};
    for (const k of LESSON_FIELDS) if (edit.fields[k]) fields[k] = String(edit.fields[k]).trim();
    if (!Object.keys(fields).length) return { status: "not_found", message: `What should change on lesson ${matches[0].number}? I can set: ${LESSON_FIELDS.join(", ")}.` };
    return finish({ kind: "lesson", action: "update", targetId: matches[0].id, targetName: `${matches[0].number}: ${matches[0].title}`, fields, createdAt: new Date().toISOString() });
  }
  if (edit.target_kind === "applications") {
    const fields = {};
    for (const k of ["opensAt", "closesAt"]) if (edit.fields[k]) fields[k] = parseWhen(edit.fields[k], k);
    if (!Object.keys(fields).length) return { status: "not_found", message: "Tell me when applications should open and/or close, for example: applications open 2026-12-01 and close 2027-01-15." };
    const bad = Object.entries(fields).find(([, v]) => v === undefined);
    if (bad) return { status: "not_found", message: `I could not read the ${bad[0] === "opensAt" ? "open" : "close"} date. Please give it as a date, for example 2026-12-01.` };
    return finish({ kind: "applications", action: "update", targetId: "applicationWindow", targetName: "the application window", fields, createdAt: new Date().toISOString() });
  }
  return { status: "not_found", message: "I can edit mentors, lessons, and the application open and close dates." };
}

/** "2026-12-01", "2026-12-01T09:00:00-05:00", "now", "none" -> ISO string, null (clear), or undefined (unreadable). */
function parseWhen(value, key) {
  const v = String(value || "").trim();
  if (/^(none|no close|clear|never|open-ended)$/i.test(v)) return null;
  if (/^now$/i.test(v)) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T${key === "opensAt" ? "09:00:00" : "23:59:00"}-05:00`).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) : "(no bound)");

function clean(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (k === "status" && !MENTOR_STATUSES.includes(s.toLowerCase())) continue;
    if ((k === "preferred" || k === "publicContact") && !/^(email|phone|linkedin|none)$/i.test(s)) continue;
    out[k] = k === "status" || k === "preferred" || k === "publicContact" ? s.toLowerCase() : s;
  }
  return out;
}

async function finish(draft) {
  draft.missing = [];
  // Check the lesson seat now, so Josef hears about a full or "No Mentor" lesson before he says YES.
  if (draft.kind === "mentor" && draft.fields.lesson && draft.fields.lesson !== "none") {
    try {
      await lessonAssignment(draft.fields.lesson, draft.targetId);
    } catch (e) {
      draft.note = `${draft.note ? draft.note + " " : ""}I left the lesson out: ${e.message}`;
      delete draft.fields.lesson;
    }
  }
  if (draft.kind === "mentor" && draft.action === "create") {
    for (const k of MENTOR_REQUIRED) if (!draft.fields[k]) draft.missing.push(k);
    draft.asked = MENTOR_ASK.filter((k) => !draft.fields[k] && !(draft.declined || []).includes(k));
  }
  const status = draft.missing.length ? "need_fields" : "ready";
  return { draft, status, message: status === "need_fields" ? askMessage(draft) : await confirmMessage(draft) };
}

// Plain labels for anything shown to Josef. Internal keys never appear in an email.
const LABEL = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  organization: "Organization",
  title: "Title",
  status: "Status",
  lesson: "Lesson",
  notes: "Notes",
  years: "Years",
  publicRole: "Role (shown to students)",
  bio: "Bio (shown to students)",
  publicBio: "Bio (shown to students)",
  preferred: "Preferred contact",
  publicContact: "Contact students can see",
  contacts: "Contact",
  date: "Date",
  startTime: "Start time",
  endTime: "End time",
  room: "Room",
  mentorLocation: "Mentor location",
  mentorStartTime: "Mentor start time",
  mentorEndTime: "Mentor end time",
  mentorBrief: "What we are looking for in a mentor",
  opens: "Opens",
  closes: "Closes",
};
const pretty = (k) => LABEL[k] || k;
const firstOf = (name) => String(name || "").trim().split(/\s+/)[0] || "them";

function askMessage(draft) {
  const first = firstOf(draft.fields.name);
  const have = Object.entries(draft.fields).map(([k, v]) => `${pretty(k)}: ${v}`).join("\n");
  const want = draft.asked.map((k) => MENTOR_FIELD_HELP[k] || k).join("\n");
  return `${draft.note ? draft.note + "\n\n" : ""}Happy to add ${draft.fields.name} to the Mentor CRM. Here is what I have so far:\n\n${have}\n\nCould you send me the rest? Reply with whatever you have, in any order; anything you do not know can stay blank except the email:\n\n${want}\n\nOnce I have ${first}'s email I will show you the full record before saving anything.`;
}

export async function confirmMessage(draft) {
  if (draft.kind === "mentor" && draft.action === "create") {
    const rec = await mentorRecordFromDraft(draft);
    const first = firstOf(rec.name);
    return `${draft.note ? draft.note + "\n\n" : ""}Here is ${first}'s record before I save it:\n\n${describeMentor(rec)}${draft.fields.lesson && draft.fields.lesson !== "none" ? `\nLesson: ${draft.fields.lesson} (cohort ${await cohortYear()})` : ""}\n\nReply YES and I will add ${first} to the Mentor CRM, or reply with any changes.`;
  }
  if (draft.kind === "mentor") {
    const current = (await readAll("mentors")).find((m) => m.id === draft.targetId);
    const next = applyMentorPatch(current, draft.fields);
    const first = firstOf(current.name);
    return `Here is the change to ${current.name}'s record:\n\n${diff(describeMentorMap(current), describeMentorMap(next))}${draft.fields.lesson ? `\nLesson: assign to lesson ${draft.fields.lesson} (cohort ${await cohortYear()})` : ""}\n\nReply YES and I will update ${first}'s record, or reply with any changes.`;
  }
  if (draft.kind === "applications") {
    const current = (await readSetting("applicationWindow")) || {};
    const next = { ...current, ...draft.fields };
    const show = (w) => ({ opens: fmtWhen(w.opensAt), closes: fmtWhen(w.closesAt) });
    if (next.opensAt && next.closesAt && next.opensAt >= next.closesAt) return `That would close applications before they open (opens ${fmtWhen(next.opensAt)}, closes ${fmtWhen(next.closesAt)}). Give me a close date after the open date.`;
    return `Here is the change to the application window:\n\n${diff(show(current), show(next))}\n\nReply YES and I will update it, or reply with any changes.`;
  }
  const current = (await readAll("lessons")).find((l) => l.id === draft.targetId);
  return `Here is the change to lesson ${draft.targetName}:\n\n${diff(pick(current, LESSON_FIELDS), pick({ ...current, ...draft.fields }, LESSON_FIELDS))}\n\nReply YES and I will update it, or reply with any changes.`;
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? ""]));

function diff(before, after) {
  return Object.keys(after)
    .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
    .map((k) => `${pretty(k)}: ${before[k] || "(blank)"} becomes ${after[k] || "(blank)"}`)
    .join("\n") || "(no change)";
}

function describeMentorMap(m) {
  return {
    name: m.name,
    status: m.status,
    contacts: (m.contacts || []).map((c) => `${c.method}: ${c.value}${c.preferred ? " (preferred)" : ""}${c.public ? " (students can see)" : " (private)"}`).join("; "),
    publicRole: m.publicRole || "",
    publicBio: m.publicBio || "",
    notes: m.notes || "",
    years: m.years || "",
  };
}

/** Apply preferred / publicContact choices to a contacts array. */
function applyContactFlags(contacts, f) {
  const list = contacts.map((c) => ({ ...c }));
  if (f.preferred) for (const c of list) c.preferred = c.method.toLowerCase() === f.preferred;
  if (f.publicContact) for (const c of list) c.public = f.publicContact !== "none" && c.method.toLowerCase() === f.publicContact;
  return list;
}

function describeMentor(m) {
  return Object.entries(describeMentorMap(m))
    .map(([k, v]) => `${pretty(k)}: ${v || "(blank)"}`)
    .join("\n");
}

async function mentorRecordFromDraft(draft) {
  const f = draft.fields;
  const contacts = [];
  if (f.email) contacts.push({ id: newId("contact"), method: "Email", value: f.email, preferred: true, public: true });
  if (f.phone) contacts.push({ id: newId("contact"), method: "Phone", value: f.phone, preferred: false, public: false });
  if (f.linkedin) contacts.push({ id: newId("contact"), method: "LinkedIn", value: f.linkedin, preferred: false, public: false });
  const role = f.publicRole || [f.title, f.organization].filter(Boolean).join(", ");
  return {
    id: newId("mentor"),
    name: f.name,
    status: MENTOR_STATUSES.includes(f.status) ? f.status : "contacted",
    contacts: applyContactFlags(contacts, f),
    notes: f.notes || "",
    lastContactedAt: "",
    years: f.years || "",
    tags: [],
    assignedLessons: [],
    publicRole: role,
    publicBio: f.bio || "",
  };
}

function applyMentorPatch(current, f) {
  const next = { ...current, contacts: [...(current.contacts || [])] };
  const setContact = (method, value, pub) => {
    const i = next.contacts.findIndex((c) => c.method.toLowerCase() === method.toLowerCase());
    const row = { id: i >= 0 ? next.contacts[i].id : newId("contact"), method, value, preferred: i >= 0 ? next.contacts[i].preferred : next.contacts.length === 0, public: i >= 0 ? next.contacts[i].public : pub };
    if (i >= 0) next.contacts[i] = row;
    else next.contacts.push(row);
  };
  if (f.name) next.name = f.name;
  if (f.status) next.status = f.status;
  if (f.email) setContact("Email", f.email, true);
  if (f.phone) setContact("Phone", f.phone, false);
  if (f.linkedin) setContact("LinkedIn", f.linkedin, false);
  if (f.notes) next.notes = f.notes;
  if (f.years) next.years = f.years;
  if (f.publicRole) next.publicRole = f.publicRole;
  else if (f.title || f.organization) next.publicRole = [f.title, f.organization].filter(Boolean).join(", ") || current.publicRole;
  if (f.bio) next.publicBio = f.bio;
  next.contacts = applyContactFlags(next.contacts, f);
  void METHOD_LABEL;
  return next;
}

/** Josef said YES: write the draft. Returns a description of what was written. */
export async function commitDraft(draft, sourceMessageId) {
  const at = new Date().toISOString();
  if (draft.kind === "mentor" && draft.action === "create") {
    const rec = await mentorRecordFromDraft(draft);
    if (draft.fields.lesson && draft.fields.lesson !== "none") rec.assignedLessons = [await lessonAssignment(draft.fields.lesson, null)];
    rec.agentLastChange = { before: null, after: snapshot(rec), at, sourceMessageId };
    await writeInsert("mentors", rec);
    return `Done: ${rec.name} is now in the Mentor CRM${rec.assignedLessons.length ? ` and assigned to lesson ${rec.assignedLessons[0].lessonNumber}` : ""}. You can see the record at ${CRM_URL}?tab=mentors.`;
  }
  if (draft.kind === "mentor") {
    const current = (await readAll("mentors")).find((m) => m.id === draft.targetId);
    if (!current) throw new Error("That mentor no longer exists.");
    const next = applyMentorPatch(current, draft.fields);
    if (draft.fields.lesson && draft.fields.lesson !== "none") {
      const a = await lessonAssignment(draft.fields.lesson, current.id);
      if (!next.assignedLessons.some((x) => x.lessonNumber === a.lessonNumber && x.cohortYear === a.cohortYear)) next.assignedLessons = [...next.assignedLessons, a];
    }
    const patch = { ...diffFields(current, next), agentLastChange: { before: snapshot(current), after: snapshot(next), at, sourceMessageId } };
    await writeUpdate("mentors", current.id, patch);
    return `Done: ${current.name}'s record is updated.`;
  }
  if (draft.kind === "applications") {
    const current = (await readSetting("applicationWindow")) || { opensAt: null, closesAt: null, applicantDomain: "tfs.ca" };
    const next = { ...current, ...draft.fields };
    if (next.opensAt && next.closesAt && next.opensAt >= next.closesAt) throw new Error("the close time must be after the open time.");
    await writeSetting("applicationWindow", next);
    await writeSetting("applicationWindowAgentLastChange", { before: current, after: next, at, sourceMessageId });
    return `Done: applications now open ${fmtWhen(next.opensAt)} and close ${fmtWhen(next.closesAt)}.`;
  }
  const current = (await readAll("lessons")).find((l) => l.id === draft.targetId);
  if (!current) throw new Error("That lesson no longer exists.");
  const next = normalizeLesson({ ...current, ...draft.fields }, current.id);
  const patch = { ...diffFields(current, next), agentLastChange: { before: snapshot(current), after: snapshot(next), at, sourceMessageId } };
  await writeUpdate("lessons", current.id, patch);
  return `Done: lesson ${draft.targetName} is updated.`;
}

async function lessonAssignment(lessonNumber, excludeMentorId) {
  const year = await cohortYear();
  const num = String(lessonNumber);
  const lesson = (await readAll("lessons")).find((l) => String(l.number) === num);
  const seats = lesson ? mentorSeats(lesson) : 1;
  if (seats === 0) throw new Error(`Lesson ${num} is set to "No Mentor" in the Lesson Editor.`);
  const others = (await readAll("mentors")).filter((m) => m.id !== excludeMentorId && (m.assignedLessons || []).some((a) => a.lessonNumber === num && a.cohortYear === year));
  if (others.length >= seats) throw new Error(`Lesson ${num} for cohort ${year} already has its mentor${seats > 1 ? "s" : ""} (${others.map((m) => m.name).join(" and ")}).`);
  return { lessonNumber: num, cohortYear: year };
}

const snapshot = (doc) => {
  const { agentLastChange, ...rest } = doc;
  return JSON.parse(JSON.stringify(rest));
};

function diffFields(before, after) {
  const out = {};
  for (const k of Object.keys(after)) if (k !== "id" && JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = after[k];
  return out;
}
