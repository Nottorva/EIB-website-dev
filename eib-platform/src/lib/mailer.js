// Outgoing email. On the live site this calls Resend's API with
// RESEND_API_KEY and sends from EMAIL_FROM. With no key set (the local
// sandbox) nothing is sent: each message is appended to data/outbox.jsonl so
// the flow can be tested end to end, and the console says so.
//
// Only one thing is emailed today: the guardian's confirmation link for the
// Student Agreement.

import fs from "node:fs";
import path from "node:path";

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "EIB <agreements@joineib.ca>";
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

// EMAIL_FROM as Resend wants it: "email@domain" or "Name <email@domain>".
// Quotes or stray spaces picked up when the variable was pasted are
// stripped; anything still malformed falls back to the default address.
export function fromAddress(raw = process.env.EMAIL_FROM) {
  const v = String(raw || "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  const plain = /^[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+$/;
  const named = /^[^<>"']+<[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+>$/;
  if (plain.test(v) || named.test(v)) return v;
  if (v) console.warn(`[eib mail] EMAIL_FROM "${raw}" is not a valid sender; using ${DEFAULT_FROM}`);
  return DEFAULT_FROM;
}

export async function sendEmail({ to, subject, text, html }) {
  const from = fromAddress();
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      const err = new Error("Email is not configured on this deployment (RESEND_API_KEY is missing).");
      err.status = 503;
      throw err;
    }
    const entry = { at: new Date().toISOString(), from, to, subject, text };
    const file = path.join(process.cwd(), "data", "outbox.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
    console.log(`[eib mail → outbox] to ${to}: ${subject}`);
    return { ok: true, mode: "outbox" };
  }
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Email could not be sent (${res.status}): ${data?.message || data?.error || "unknown error"}`);
    err.status = 502;
    throw err;
  }
  return { ok: true, mode: "resend", id: data?.id };
}
