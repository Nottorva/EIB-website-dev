// One-time demo links for AIDA Unlocked.
//
// A super admin makes a link (/demo/<id>) and sends it to someone with no account. The first person to
// press "Start the demo" on it claims it: their browser gets a secret cookie, and from then on the link
// works in that browser only. Anyone else who opens it is told it has been used.
//
// Opening the page does not claim the link (chat apps and mail scanners open links to preview them);
// pressing the button does.
//
// A claimed link is not open-ended: it lasts DEMO_HOURS from the first press and DEMO_MAX_MESSAGES
// messages, whichever runs out first. A link nobody starts lapses after DEMO_UNUSED_DAYS.
//
//   aida_demo_links   { id, label, createdAt, expiresAt, usedAt, sessionHash, sessionEndsAt, messages, cost }
//
// Nothing a visitor types is stored here: the conversation lives in their browser.

import { randomBytes, createHash } from "crypto";
import { findAll, findById, insert, updateOne, removeOne } from "../data/store";
import { costOf } from "./config";

export const DEMO_MAX_MESSAGES = 40;
export const DEMO_HOURS = 24;
export const DEMO_UNUSED_DAYS = 14;

const HOUR = 3600 * 1000;
const hash = (secret) => createHash("sha256").update(String(secret)).digest("hex");
const iso = (ms) => new Date(ms).toISOString();
export const demoCookie = (id) => `eib_demo_${String(id).slice(0, 12)}`;
const validId = (id) => /^[A-Za-z0-9_-]{20,40}$/.test(String(id || ""));

export async function createDemoLink(label) {
  const now = Date.now();
  return insert("aida_demo_links", { id: randomBytes(18).toString("base64url"), label: String(label || "").trim().slice(0, 80), createdAt: iso(now), expiresAt: iso(now + DEMO_UNUSED_DAYS * 24 * HOUR), usedAt: "", sessionHash: "", sessionEndsAt: "", messages: 0, cost: 0 });
}
export const getDemoLink = async (id) => (validId(id) ? findById("aida_demo_links", id) : null);
export const deleteDemoLink = (id) => removeOne("aida_demo_links", id);

/**
 * Where a link stands for the browser holding `secret` (its cookie, or nothing):
 *   missing   no such link (or it was deleted)
 *   expired   never started, and too old
 *   ready     never started: this browser may claim it
 *   active    claimed by this browser; `left` messages remain
 *   ended     claimed by this browser, but out of time or messages
 *   spent     claimed by another browser
 */
export function demoState(link, secret, at = Date.now()) {
  if (!link) return { status: "missing" };
  if (!link.usedAt) return { status: at < Date.parse(link.expiresAt) ? "ready" : "expired" };
  if (!secret || hash(secret) !== link.sessionHash) return { status: "spent" };
  const left = Math.max(0, DEMO_MAX_MESSAGES - (link.messages || 0));
  if (at >= Date.parse(link.sessionEndsAt)) return { status: "ended", left: 0, why: "time" };
  if (!left) return { status: "ended", left: 0, why: "messages" };
  return { status: "active", left, endsAt: link.sessionEndsAt };
}

/** Claims a link for one browser. Returns its secret (to keep in a cookie), or null if it cannot be claimed. */
export async function claimDemoLink(id) {
  const link = await getDemoLink(id);
  if (demoState(link).status !== "ready") return null;
  const secret = randomBytes(24).toString("base64url");
  const now = Date.now();
  await updateOne("aida_demo_links", link.id, { usedAt: iso(now), sessionHash: hash(secret), sessionEndsAt: iso(now + DEMO_HOURS * HOUR) });
  return secret;
}

/** One message used. Counted before the reply is written, so a dropped connection cannot be replayed for free. */
export async function countDemoMessage(link) {
  await updateOne("aida_demo_links", link.id, { messages: (link.messages || 0) + 1 });
}
export async function addDemoCost(id, usage) {
  const link = await findById("aida_demo_links", id);
  if (link) await updateOne("aida_demo_links", id, { cost: (link.cost || 0) + costOf(usage) });
}

/** For the AIDA Unlocked page: every link, newest first, with where it stands. */
export async function listDemoLinks() {
  const now = Date.now();
  return (await findAll("aida_demo_links"))
    .map((l) => {
      const status = !l.usedAt ? (now < Date.parse(l.expiresAt) ? "unused" : "expired") : now < Date.parse(l.sessionEndsAt) && (l.messages || 0) < DEMO_MAX_MESSAGES ? "open" : "spent";
      // The address is only worth showing while the link can still be claimed.
      return { id: l.id, label: l.label, createdAt: l.createdAt, expiresAt: l.expiresAt, usedAt: l.usedAt, sessionEndsAt: l.sessionEndsAt, messages: l.messages || 0, cost: l.cost || 0, status };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
