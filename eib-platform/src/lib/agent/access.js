// Who may ask the agent questions: individual email addresses only, never whole domains. The env list
// (TFS_WHITELIST_ADDRESSES) plus a list Josef manages by email ("give x@tfs.ca access", "remove access from
// x@tfs.ca", "who has agent access?") or on the /agent page. Stored in the `agentAccess` setting as
// { addresses: [{ email, name, addedAt, addedBy }] }. (Older records may still carry a `domains` list; it is ignored.)

import { getSetting, setSetting } from "../data/store";
import { agentConfig } from "./config";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "");

export async function getAccess() {
  const v = (await getSetting("agentAccess")) || {};
  return { addresses: Array.isArray(v.addresses) ? v.addresses : [] };
}

/** Everything that grants access, env and stored, for classification and for the page. */
export async function effectiveAccess() {
  const cfg = agentConfig();
  const stored = await getAccess();
  return {
    envAddresses: cfg.whitelistAddresses,
    addresses: stored.addresses,
    allAddresses: [...new Set([...cfg.whitelistAddresses, ...stored.addresses.map((a) => a.email)])],
  };
}

export async function grantAccess(target, { name = "", addedBy = "" } = {}) {
  const t = norm(target);
  if (!t) throw new Error("Give me an email address.");
  if (!t.includes("@")) throw new Error(`I only give access to individual email addresses, not whole domains like ${t}. Tell me each person's address.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new Error(`"${target}" is not an email address.`);
  const access = await getAccess();
  if (access.addresses.some((a) => a.email === t)) return { changed: false, message: `${t} already has access.` };
  access.addresses.push({ email: t, name, addedAt: new Date().toISOString(), addedBy });
  await setSetting("agentAccess", access);
  return { changed: true, message: `${t} now has access.` };
}

export async function revokeAccess(target) {
  const t = norm(target);
  const access = await getAccess();
  const before = access.addresses.length;
  access.addresses = access.addresses.filter((a) => a.email !== t);
  if (access.addresses.length === before) {
    const cfg = agentConfig();
    if (cfg.whitelistAddresses.includes(t)) return { changed: false, message: `${t} is fixed in the site settings, so I cannot remove it by email.` };
    if (!t.includes("@")) return { changed: false, message: `Access is given per person, not per domain, so there is no ${t} entry to remove. Tell me which address to remove.` };
    return { changed: false, message: `${t} does not have access.` };
  }
  await setSetting("agentAccess", access);
  return { changed: true, message: `${t} no longer has access.` };
}

export async function describeAccess() {
  const a = await effectiveAccess();
  const lines = [];
  for (const e of a.envAddresses) lines.push(`  ${e}`);
  for (const x of a.addresses) lines.push(`  ${x.name ? `${x.name} <${x.email}>` : x.email} (added ${x.addedAt.slice(0, 10)})`);
  return lines.length
    ? `These people can ask me questions:\n${lines.join("\n")}\n\nAccess is per person, never a whole domain. Reply "give <email> access" or "remove access from <email>" to change it. Only you can approve changes.`
    : `Nobody has access yet besides you. Reply "give <email> access" to add someone.`;
}

// Testing aid: one of Josef's own addresses can be treated as a plain colleague for a while, so the
// staff experience (answers only, no edits, no contact details) can be tried without a real colleague.
// Stored in the `agentTestColleagues` setting as [{ email, until, by }]; it switches itself off at `until`.
export const TEST_COLLEAGUE_HOURS = 24;

export async function getTestColleagues() {
  const v = (await getSetting("agentTestColleagues")) || [];
  const t = Date.now();
  return (Array.isArray(v) ? v : []).filter((x) => x?.email && new Date(x.until).getTime() > t);
}

export async function setTestColleague(email, on, { by = "" } = {}) {
  const t = norm(email);
  const cfg = agentConfig();
  if (!cfg.josefAddresses.includes(t)) throw new Error(`${t} is not one of your addresses.`);
  if (t === cfg.josefAddresses[0]) throw new Error(`${t} is your main address and always counts as you.`);
  const list = (await getTestColleagues()).filter((x) => x.email !== t);
  if (on) list.push({ email: t, until: new Date(Date.now() + TEST_COLLEAGUE_HOURS * 3600e3).toISOString(), by });
  await setSetting("agentTestColleagues", list);
  return { changed: true, message: on ? `${t} is treated as a colleague for the next ${TEST_COLLEAGUE_HOURS} hours (answers only, no edits). It counts as you again after that, or when you untick the box.` : `${t} counts as you again.` };
}
