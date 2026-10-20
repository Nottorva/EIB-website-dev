// `events` collection: CRM-only happenings (EIB Night, a panel, a visit)
// that need a mentor or community member but are not lessons. Nothing here
// reaches students; the only reader is the Mentor CRM's Sessions tab, where
// events sit among the lessons in an order the super admin drags into place.
//
//   anchor  "start" or a lesson number: the lesson the event follows
//   rank    order among events on the same anchor (any number; gaps are fine)

import { findAll, findById, insert, updateOne, removeOne, newId } from "./store";

export const EVENT_FIELDS = ["title", "date", "startTime", "endTime", "location", "note", "anchor", "rank", "mentorIds"];

export async function listEvents() {
  return findAll("events");
}

export async function getEvent(id) {
  return findById("events", id);
}

function clean(patch) {
  const out = {};
  for (const key of ["title", "date", "startTime", "endTime", "location", "note", "anchor"]) {
    if (key in patch) out[key] = String(patch[key] ?? "").slice(0, key === "note" ? 4000 : 200);
  }
  if ("rank" in patch) out.rank = Number.isFinite(Number(patch.rank)) ? Number(patch.rank) : 0;
  if ("mentorIds" in patch) {
    const ids = Array.isArray(patch.mentorIds) ? patch.mentorIds : [];
    out.mentorIds = [...new Set(ids.map(String))];
  }
  return out;
}

export async function createEvent(input = {}) {
  const fields = clean(input);
  return insert("events", {
    id: newId("event"),
    title: fields.title || "New event",
    date: fields.date || "",
    startTime: fields.startTime || "",
    endTime: fields.endTime || "",
    location: fields.location || "",
    note: fields.note || "",
    anchor: fields.anchor || "start",
    rank: fields.rank || 0,
    mentorIds: fields.mentorIds || [],
  });
}

// `keys` limits which fields may change (the CRM roles may only touch
// mentorIds; the super admin may touch everything).
export async function updateEvent(id, patch, keys = EVENT_FIELDS) {
  const fields = clean(patch);
  const allowed = {};
  for (const key of keys) if (key in fields) allowed[key] = fields[key];
  return updateOne("events", id, allowed);
}

export async function deleteEvent(id) {
  return removeOne("events", id);
}

// A mentor removed from the CRM leaves every event they were on.
export async function removeMentorFromEvents(mentorId) {
  const all = await listEvents();
  for (const ev of all) {
    if ((ev.mentorIds || []).includes(mentorId)) {
      await updateOne("events", ev.id, { mentorIds: ev.mentorIds.filter((m) => m !== mentorId) });
    }
  }
}
