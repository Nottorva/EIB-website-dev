// How every email the agent writes is put together: a first-name greeting, the body paragraphs, the
// references it drew on, a sign-off on Josef's behalf, and the AI disclosure in the footer. The model writes
// paragraphs; this file wraps them. Plain text here; mail.js turns the same text into the HTML version.

import { agentConfig } from "./config";

export const SITE_URL = "https://www.joineib.ca";
export const CRM_URL = `${SITE_URL}/crm`;
export const CHANGES_URL = `${SITE_URL}/changes`;

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

/** Emails are plain text: any markdown the model slipped in is turned into plain words. */
function stripMarkdown(s) {
  return String(s ?? "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1: $2");
}

function signOff() {
  const { josefName } = agentConfig();
  return `Best,\nEIB Assistant, on behalf of ${josefName}\n--\nEIB Assistant is an AI assistant working for ${josefName}. You can reply to Josef directly anytime.`;
}

const clean = (body) => stripMarkdown(scrubDashes(String(body || "").trim()));

/** "References:" lines: the documents and platform pages an answer drew on. mail.js turns these into links. */
function referencesBlock(references) {
  const refs = (references || []).filter((r) => r && r.title && r.url);
  if (!refs.length) return "";
  return `References:\n${refs.map((r) => `- ${r.title}: ${r.url}`).join("\n")}`;
}

/** A complete email body for a person outside: greeting, paragraphs, references, sign-off, disclosure. */
export function compose({ firstName, body, references = [] }) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const refs = referencesBlock(references);
  return `${greeting}\n\n${clean(body)}${refs ? `\n\n${refs}` : ""}\n\n${signOff()}`;
}

/** A note to Josef himself: same sign-off and disclosure, shorter body. */
export function composeForJosef(body, references = []) {
  const { josefName } = agentConfig();
  const first = firstNameOf({ name: josefName }) || "Josef";
  const refs = referencesBlock(references);
  return `Hi ${first},\n\n${clean(body)}${refs ? `\n\n${refs}` : ""}\n\n${signOff()}`;
}

/** Model output sometimes arrives with its own greeting or sign-off; strip them so compose() adds one set. */
export function bareBody(text) {
  let t = String(text || "").trim();
  t = t.replace(/^(hi|hello|hey|dear|bonjour)\b[^\n]*\n+/i, "");
  t = t.replace(/\n+(best|regards|kind regards|thanks|thank you|cheers|cordialement|merci)[,!.]?\s*\n[\s\S]*$/i, "");
  t = t.replace(/\n+--\s*\n[\s\S]*$/, "");
  t = t.replace(/\n+references?\s*:\s*\n[\s\S]*$/i, "");
  return t.trim();
}
