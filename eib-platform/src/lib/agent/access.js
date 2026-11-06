// Who may ask the agent questions: the env whitelist (TFS_WHITELIST_*) plus a list Josef manages by email
// ("give x access", "remove access from x", "who has agent access?") or on the /agent page. Stored in the
// `agentAccess` setting as { addresses: [{ email, name, addedAt, addedBy }], domains: [{ domain, addedAt, addedBy }] }.

import { getSetting, setSetting } from "../data/store";
import { agentConfig } from "./config";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "");

export async function getAccess() {
  const v = (await getSetting("agentAccess")) || {};
  return { addresses: Array.isArray(v.addresses) ? v.addresses : [], domains: Array.isArray(v.domains) ? v.domains : [] };
}

/** Everything that grants access, env and stored, for classification and for the page. */
export async function effectiveAccess() {
  const cfg = agentConfig();
  const stored = await getAccess();
  return {
    envDomains: cfg.whitelistDomains,
    envAddresses: cfg.whitelistAddresses,
    addresses: stored.addresses,
    domains: stored.domains,
    allDomains: [...new Set([...cfg.whitelistDomains, ...stored.domains.map((d) => d.domain)])],
    allAddresses: [...new Set([...cfg.whitelistAddresses, ...stored.addresses.map((a) => a.email)])],
  };
}

export async function grantAccess(target, { name = "", addedBy = "" } = {}) {
  const t = norm(target);
  if (!t) throw new Error("Give me an email address or a domain.");
  const access = await getAccess();
  const isDomain = !t.includes("@");
  if (isDomain) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(t)) throw new Error(`"${target}" is not a domain or an email address.`);
    if (access.domains.some((d) => d.domain === t)) return { changed: false, message: `${t} already has access (whole domain).` };
    access.domains.push({ domain: t, addedAt: new Date().toISOString(), addedBy });
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw new Error(`"${target}" is not an email address.`);
    if (access.addresses.some((a) => a.email === t)) return { changed: false, message: `${t} already has access.` };
    access.addresses.push({ email: t, name, addedAt: new Date().toISOString(), addedBy });
  }
  await setSetting("agentAccess", access);
  return { changed: true, message: `${t} now has access${isDomain ? " (whole domain)" : ""}.` };
}

export async function revokeAccess(target) {
  const t = norm(target);
  const access = await getAccess();
  const before = access.addresses.length + access.domains.length;
  access.addresses = access.addresses.filter((a) => a.email !== t);
  access.domains = access.domains.filter((d) => d.domain !== t);
  if (access.addresses.length + access.domains.length === before) {
    const cfg = agentConfig();
    if (cfg.whitelistAddresses.includes(t) || cfg.whitelistDomains.includes(t)) return { changed: false, message: `${t} is granted by the TFS_WHITELIST setting on Vercel, which I cannot change by email. Remove it there.` };
    return { changed: false, message: `${t} does not have access.` };
  }
  await setSetting("agentAccess", access);
  return { changed: true, message: `${t} no longer has access.` };
}

export async function describeAccess() {
  const a = await effectiveAccess();
  const lines = [];
  for (const d of a.envDomains) lines.push(`  everyone at @${d} (set on Vercel)`);
  for (const e of a.envAddresses) lines.push(`  ${e} (set on Vercel)`);
  for (const d of a.domains) lines.push(`  everyone at @${d.domain} (added ${d.addedAt.slice(0, 10)})`);
  for (const x of a.addresses) lines.push(`  ${x.name ? `${x.name} <${x.email}>` : x.email} (added ${x.addedAt.slice(0, 10)})`);
  return lines.length
    ? `These people can ask me questions:\n${lines.join("\n")}\n\nReply "give <email or domain> access" or "remove access from <email or domain>" to change it. Only you can edit data.`
    : `Nobody has access yet besides you. Reply "give <email or domain> access" to add someone.`;
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
