// `mentors` collection. Two rules live here:
//   1. One mentor per lesson per cohort year (assignLesson enforces it).
//   2. `contacts[]` never leaves the server on a student-facing route.
//      Use toPublicMentor() for anything the lesson view receives.

import { findAll, findById, insert, updateOne, removeOne, newId } from "./store";

export const MENTOR_STATUSES = ["contacted", "responsive", "unresponsive", "confirmed"];

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
    assignedLessons: [],
    publicRole: "",
    publicBio: "",
  });
}

// Updates everything except assignedLessons, which only assignLesson touches.
export async function updateMentor(id, patch) {
  const allowed = {};
  for (const key of ["name", "status", "contacts", "notes", "lastContactedAt", "publicRole", "publicBio"]) {
    if (key in patch) allowed[key] = patch[key];
  }
  if (allowed.status && !MENTOR_STATUSES.includes(allowed.status)) delete allowed.status;
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
  return removeOne("mentors", id);
}

export async function findMentorForLesson(lessonNumber, cohortYear, excludeId) {
  const all = await listMentors();
  return (
    all.find(
      (m) =>
        m.id !== excludeId &&
        m.assignedLessons.some((a) => a.lessonNumber === String(lessonNumber) && a.cohortYear === Number(cohortYear))
    ) || null
  );
}

// Assign or unassign a lesson for a cohort year. Throws 409 if another mentor
// already holds that lesson for that year.
export async function assignLesson(mentorId, { lessonNumber, cohortYear, assign }) {
  const mentor = await getMentor(mentorId);
  if (!mentor) return null;
  const num = String(lessonNumber);
  const year = Number(cohortYear);

  if (assign) {
    const owner = await findMentorForLesson(num, year, mentorId);
    if (owner) {
      const err = new Error(`Lesson ${num} for cohort ${year} is already assigned to ${owner.name}.`);
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
