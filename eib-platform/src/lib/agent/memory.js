// Long-term memory: one document per topic in `agent_memory` (main database), with a history of earlier
// versions. Josef changes it by email ("remember:", "forget:", or just by saying things) and on the website
// (/crm?tab=memory). Everyone's answers may draw on it; only Josef's addresses may change it.

import { findAll, findOne, insert, updateOne, removeOne, newId } from "../data/store";

export const MEMORY_STATUSES = ["waiting", "done", "info"];
/** Topics done this long ago move to the archived section and leave the agent's context. */
export const ARCHIVE_AFTER_DAYS = 60;
/** A topic nobody has touched for this long is deleted (the daily cron does it). Every create, update, edit,
 *  and every answer that draws on the topic refreshes its lastUsedAt. */
export const DELETE_AFTER_DAYS = 365;

const now = () => new Date().toISOString();
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export async function listMemory() {
  const rows = await findAll("agent_memory");
  return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function isArchived(item) {
  return item.status === "done" && Date.parse(item.updatedAt || 0) < Date.now() - ARCHIVE_AFTER_DAYS * 86400_000;
}

export async function findTopic(topic) {
  const t = norm(topic);
  if (!t) return null;
  const exact = await findOne("agent_memory", (m) => norm(m.topic) === t);
  if (exact) return exact;
  return findOne("agent_memory", (m) => norm(m.topic).includes(t) || t.includes(norm(m.topic)));
}

/** Create or update a topic. Updates push the old version into history. */
export async function upsertMemory({ topic, status, summary, source, sourceEmailId = "", matchTopic = "" }) {
  const cleanStatus = MEMORY_STATUSES.includes(String(status).toLowerCase()) ? String(status).toLowerCase() : "info";
  const existing = (matchTopic && (await findTopic(matchTopic))) || (await findTopic(topic));
  if (existing) {
    const history = [...(existing.history || []), { summary: existing.summary, status: existing.status, at: existing.updatedAt, source: existing.updatedBy }].slice(-20);
    const updated = await updateOne("agent_memory", existing.id, { topic: topic?.trim() || existing.topic, status: cleanStatus, summary: String(summary || "").trim(), updatedAt: now(), lastUsedAt: now(), updatedBy: source, sourceEmailId, history });
    return { item: updated, created: false, before: existing };
  }
  const item = await insert("agent_memory", { id: newId("mem"), topic: String(topic || "").trim(), status: cleanStatus, summary: String(summary || "").trim(), createdAt: now(), updatedAt: now(), lastUsedAt: now(), updatedBy: source, sourceEmailId, history: [] });
  return { item, created: true, before: null };
}

export async function forgetMemory(topic) {
  const item = await findTopic(topic);
  if (!item) return null;
  await removeOne("agent_memory", item.id);
  return item;
}

export async function patchMemory(id, patch) {
  const existing = await findOne("agent_memory", (m) => m.id === id);
  if (!existing) return null;
  const history = [...(existing.history || []), { summary: existing.summary, status: existing.status, at: existing.updatedAt, source: existing.updatedBy }].slice(-20);
  const fields = {};
  if (patch.topic !== undefined) fields.topic = String(patch.topic).trim();
  if (patch.status !== undefined && MEMORY_STATUSES.includes(patch.status)) fields.status = patch.status;
  if (patch.summary !== undefined) fields.summary = String(patch.summary).trim();
  return updateOne("agent_memory", id, { ...fields, updatedAt: now(), lastUsedAt: now(), updatedBy: "web", history });
}

/** The topic was drawn on for an answer: its year-long timer starts again. */
export async function touchMemory(items) {
  for (const m of items) await updateOne("agent_memory", m.id, { lastUsedAt: now() });
}

export const lastUsed = (m) => m.lastUsedAt || m.updatedAt || m.createdAt;

/** Delete topics untouched for DELETE_AFTER_DAYS. Returns the deleted topics. */
export async function purgeStaleMemory(days = DELETE_AFTER_DAYS) {
  const cutoff = Date.now() - days * 86400_000;
  const stale = (await listMemory()).filter((m) => Date.parse(lastUsed(m) || 0) < cutoff);
  for (const m of stale) await removeOne("agent_memory", m.id);
  return stale;
}

export async function deleteMemory(id) {
  return removeOne("agent_memory", id);
}

/** Current, non-archived memory as text for prompts. */
export async function memoryContext() {
  const items = (await listMemory()).filter((m) => !isArchived(m));
  if (!items.length) return "";
  const lines = items.map((m) => `- [${m.status}] ${m.topic}: ${m.summary} (updated ${String(m.updatedAt).slice(0, 10)})`);
  return `<memory>\nThings Josef has told the assistant to keep in mind:\n${lines.join("\n")}\n</memory>`;
}

/** Topics matching some words, for "what do you remember about X" and the search tool. */
export async function searchMemory(query) {
  const words = norm(query).split(/\W+/).filter((w) => w.length > 2);
  const items = (await listMemory()).filter((m) => !isArchived(m));
  if (!words.length) return items;
  const hits = items
    .map((m) => ({ m, score: words.reduce((n, w) => n + (norm(`${m.topic} ${m.summary}`).includes(w) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
  await touchMemory(hits.slice(0, 8));
  return hits;
}

export function describeMemory(items) {
  if (!items.length) return "I have nothing on that yet.";
  const order = { waiting: 0, info: 1, done: 2 };
  return items
    .slice()
    .sort((a, b) => order[a.status] - order[b.status])
    .map((m) => `${m.topic} (${m.status}): ${m.summary}`)
    .join("\n");
}
