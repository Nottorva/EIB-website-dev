// `testimonials` collection: quotes shown on the public site. Written only by
// the super admin from the Website page; the site renders `approved` rows
// only. Nothing here is ever fabricated by the app: an empty collection means
// the site shows clearly-labelled placeholders until real quotes are added.

import { findAll, findById, insert, replaceOne, removeOne, newId } from "./store";

export function normalizeTestimonial(input, id) {
  return {
    id,
    quote: String(input.quote ?? "").trim(),
    name: String(input.name ?? "").trim(),
    role: String(input.role ?? "").trim(), // "Student", "Faculty sponsor", "Mentor" ... the small label above the quote
    org: String(input.org ?? "").trim(), // "Cohort 03", "Partner school" ... the attribution line
    photo: String(input.photo ?? "").trim(), // a URL or a path under /public (e.g. /site/v-1.jpg)
    approved: Boolean(input.approved),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export async function listTestimonials() {
  const rows = await findAll("testimonials");
  return [...rows].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function listApprovedTestimonials() {
  return (await listTestimonials()).filter((t) => t.approved && t.quote);
}

export async function createTestimonial(input) {
  return insert("testimonials", normalizeTestimonial(input, newId("tm")));
}

export async function saveTestimonial(id, input) {
  const existing = await findById("testimonials", id);
  if (!existing) return null;
  return replaceOne("testimonials", id, normalizeTestimonial({ ...existing, ...input }, id));
}

export async function deleteTestimonial(id) {
  return removeOne("testimonials", id);
}

export function toPublicTestimonial(t) {
  return { id: t.id, quote: t.quote, name: t.name, role: t.role, org: t.org, photo: t.photo };
}
