// Who sent this, and what may they get. Identity comes from email authentication, never from the From line
// alone. This is the single gate in front of the edit path.
//
//   josef      From is one of JOSEF_ADDRESSES, DKIM and DMARC pass, and a DKIM signature is from that
//              address's domain (or DMARC-aligned when the raw signature list is unavailable).
//   tfs        From address is on the access list (env whitelist plus the stored list), DKIM/DMARC pass. Never a whole domain.
//   unknown    everyone else, including any Josef-lookalike that fails authentication.

import { agentConfig } from "./config";
import { effectiveAccess, getTestColleagues } from "./access";

const pass = (v) => String(v || "").toLowerCase() === "pass";

function orgDomain(domain) {
  const parts = String(domain || "").split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : domain;
}

export async function classifySender(email) {
  const cfg = agentConfig();
  const from = email.from;
  const authed = pass(email.auth.dkim) && pass(email.auth.dmarc);
  // Test switch on /agent: one of Josef's addresses may be acting as a plain colleague for a while.
  const actingAsColleague = (await getTestColleagues()).some((t) => t.email === from.email);
  const isJosefAddress = cfg.josefAddresses.includes(from.email) && !actingAsColleague;
  let signedByOwnDomain = false;
  if (email.dkimDomains.length) {
    signedByOwnDomain = email.dkimDomains.some((d) => d === from.domain || orgDomain(d) === orgDomain(from.domain));
  } else {
    // No raw signature list: DMARC pass already proves alignment with the From domain.
    signedByOwnDomain = pass(email.auth.dmarc);
  }
  if (isJosefAddress && authed && signedByOwnDomain) return { kind: "josef", why: "address listed, DKIM and DMARC pass, signed by own domain" };
  if (isJosefAddress) return { kind: "unknown", why: `Josef address but authentication failed (spf ${email.auth.spf}, dkim ${email.auth.dkim}, dmarc ${email.auth.dmarc})`, lookalike: true };

  const access = await effectiveAccess();
  const whitelisted = actingAsColleague || access.allAddresses.includes(from.email);
  if (whitelisted && authed) return { kind: "tfs", why: actingAsColleague ? "one of Josef's addresses, treated as a colleague for testing" : "on the access list and authenticated" };
  if (whitelisted) return { kind: "unknown", why: `on the access list but authentication failed (dkim ${email.auth.dkim}, dmarc ${email.auth.dmarc})` };
  return { kind: "unknown", why: "not on the access list" };
}

/** True when the agent is only in CC (not in To). */
export function agentOnlyCcd(email) {
  const me = agentConfig().address;
  const inTo = email.to.some((a) => a.email === me);
  const inCc = email.cc.some((a) => a.email === me);
  return !inTo && inCc;
}

/** The people on the thread besides the agent and Josef, for replies. */
export function otherParticipants(email) {
  const cfg = agentConfig();
  const skip = new Set([cfg.address, ...cfg.josefAddresses]);
  return [...email.to, ...email.cc].map((a) => a.email).filter((e) => !skip.has(e));
}
