// How every email the agent writes is put together: a first-name greeting, the body paragraphs, a sign-off
// on Josef's behalf, and the AI disclosure in the footer. The model writes paragraphs; this file wraps them.

import { agentConfig } from "./config";

export const CRM_URL = "https://www.joineib.ca/crm";

/** First name from a display name, a CRM record, or a signature line. Null when only an address is known. */
export function firstNameOf({ name = "", email = "" } = {}) {
  let n = String(name || "").replace(/^["']+|["']+$/g, "").trim();
  if (!n || n.includes("@")) return null;
  // "Marshall, Josef" -> Josef
  if (n.includes(",")) n = n.split(",")[1].trim();
  const first = n.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, "");
  if (!first || first.length < 2) return null;
  return first[0].toUpperCase() + first.slice(1);
  void email;
}

/** Em and en dashes never appear: ranges become "to", the rest become commas. */
export function scrubDashes(s) {
  return String(s ?? "")
    .replace(/(\d)\s*–\s*(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/,\s*,/g, ",");
}

/** A complete email body for a person outside: greeting, paragraphs, sign-off, disclosure. */
export function compose({ firstName, body }) {
  const { josefName } = agentConfig();
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const text = scrubDashes(String(body || "").trim());
  return `${greeting}\n\n${text}\n\nBest,\nEIB Assistant, on behalf of ${josefName}\n\n--\nEIB Assistant is an AI assistant working for ${josefName}. You can reply to Josef directly anytime.`;
}

/** A shorter note to Josef himself. */
export function composeForJosef(body) {
  const { josefName } = agentConfig();
  const first = firstNameOf({ name: josefName }) || "Josef";
  return `Hi ${first},\n\n${scrubDashes(String(body || "").trim())}\n\nBest,\nEIB Assistant`;
}

/** Model output sometimes arrives with its own greeting or sign-off; strip them so compose() adds one set. */
export function bareBody(text) {
  let t = String(text || "").trim();
  t = t.replace(/^(hi|hello|hey|dear|bonjour)\b[^\n]*\n+/i, "");
  t = t.replace(/\n+(best|regards|kind regards|thanks|thank you|cheers|cordialement|merci)[,!.]?\s*\n[\s\S]*$/i, "");
  t = t.replace(/\n+--\s*\n[\s\S]*$/, "");
  return t.trim();
}
