// `mentors` collection. Two rules live here:
//   1. A lesson takes as many mentors per cohort year as the Lesson Editor
//      gives it seats (none, one or two); assignLesson enforces it.
//   2. `contacts[]` never leaves the server on a student-facing route.
//      Use toPublicMentor() for anything the lesson view receives.

import { findAll, findById, insert, updateOne, removeOne, newId } from "./store";
import { removeMentorFromEvents } from "./events";
import { mentorSeats } from "../sessionDefaults";
import { listLessons } from "./lessons";

export const MENTOR_STATUSES = ["contacted", "responsive", "unresponsive", "unsure", "confirmed"];
// Internal-only labels for what a mentor has done with EIB. `years` is free
// text shown beside the name ("'26 | '27"). Neither reaches a student route.
export const MENTOR_TAGS = ["speaker", "mentor", "panelist"];

export async function listMentors() {
  return findAll("mentors");
}

export async function getMentor(id) {
  return findById("mentors", id);
}

export async function createMentor(input = {}) {
  return insert("mentors", {
    id: newId("mentor"),
    name: input.name || "New Mentor",
    status: MENTOR_STATUSES.includes(input.status) ? input.status : "contacted",
    contacts: [],
    notes: "",
    lastContactedAt: "",
    years: "",
    tags: [],
    assignedLessons: [],
    publicRole: "",
    publicBio: "",
  });
}

// Updates everything except assignedLessons, which only assignLesson touches.
export async function updateMentor(id, patch) {
  const allowed = {};
  for (const key of ["name", "status", "contacts", "notes", "lastContactedAt", "years", "tags", "publicRole", "publicBio"]) {
    if (key in patch) allowed[key] = patch[key];
  }
  if (allowed.status && !MENTOR_STATUSES.includes(allowed.status)) delete allowed.status;
  if ("years" in allowed) allowed.years = String(allowed.years ?? "").slice(0, 60);
  if ("tags" in allowed) {
    const list = Array.isArray(allowed.tags) ? allowed.tags : [];
    allowed.tags = MENTOR_TAGS.filter((t) => list.includes(t));
  }
  if (allowed.contacts) {
    allowed.contacts = allowed.contacts.map((c) => ({
      id: c.id || newId("contact"),
      method: String(c.method || "Other"),
      value: String(c.value || ""),
      preferred: Boolean(c.preferred),
      public: Boolean(c.public),
    }));
  }
  return updateOne("mentors", id, allowed);
}

export async function deleteMentor(id) {
  await removeMentorFromEvents(id);
  return removeOne("mentors", id);
}

export async function mentorsForLesson(lessonNumber, cohortYear, excludeId) {
  const all = await listMentors();
  return all.filter(
    (m) =>
      m.id !== excludeId &&
      m.assignedLessons.some((a) => a.lessonNumber === String(lessonNumber) && a.cohortYear === Number(cohortYear))
  );
}

// Assign or unassign a lesson for a cohort year. Throws 409 if the lesson is
// set to "No Mentor" or already has every seat filled for that year. A lesson
// number with no lesson behind it gets one seat.
export async function assignLesson(mentorId, { lessonNumber, cohortYear, assign }) {
  const mentor = await getMentor(mentorId);
  if (!mentor) return null;
  const num = String(lessonNumber);
  const year = Number(cohortYear);

  if (assign) {
    const lesson = (await listLessons()).find((l) => l.number === num);
    const seats = lesson ? mentorSeats(lesson) : 1;
    if (seats === 0) {
      const err = new Error(`Lesson ${num} is set to "No Mentor" in the Lesson Editor.`);
      err.status = 409;
      throw err;
    }
    const others = await mentorsForLesson(num, year, mentorId);
    if (others.length >= seats) {
      const names = others.map((m) => m.name).join(" and ");
      const err = new Error(
        seats === 1
          ? `Lesson ${num} for cohort ${year} already has its mentor (${names}). Unassign them first, or give the lesson a second seat with "Mentor x2" in the Lesson Editor.`
          : `Lesson ${num} for cohort ${year} already has both mentors (${names}). Unassign one first.`
      );
      err.status = 409;
      throw err;
    }
    const already = mentor.assignedLessons.some((a) => a.lessonNumber === num && a.cohortYear === year);
    if (already) return mentor;
    return updateOne("mentors", mentorId, {
      assignedLessons: [...mentor.assignedLessons, { lessonNumber: num, cohortYear: year }],
    });
  }

  return updateOne("mentors", mentorId, {
    assignedLessons: mentor.assignedLessons.filter((a) => !(a.lessonNumber === num && a.cohortYear === year)),
  });
}

// The only shape of a mentor a student-facing route may return.
export function publicContactString(mentor) {
  const options = (mentor.contacts || []).filter((c) => c.public && String(c.value || "").trim());
  if (options.length === 0) return null;
  const chosen = options.find((c) => c.preferred) || options[0];
  return `${chosen.method} (${chosen.value})`;
}

export function toPublicMentor(mentor) {
  if (!mentor) return null;
  return {
    id: mentor.id,
    name: mentor.name,
    role: mentor.publicRole || "",
    bio: mentor.publicBio || "",
    contactMethod: publicContactString(mentor),
  };
}
