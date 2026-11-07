// Resend, both directions: webhook verification, fetching a received email (JSON plus the raw message's
// headers), auto-reply detection, and sending replies that thread correctly. No SDK: plain fetch, like mailer.js.

import crypto from "node:crypto";
import { agentConfig, agentSandbox } from "./config";

const API = "https://api.resend.com";
const UA = "eib-platform-agent/1.0";

// ---------------------------------------------------------------------------
// Webhook signature (Svix scheme): HMAC-SHA256 over "id.timestamp.body" with the base64 secret
// after "whsec_", base64-encoded, compared against any "v1,<sig>" in the svix-signature header.
// ---------------------------------------------------------------------------
export function verifyWebhook({ rawBody, headers, secret, now = Date.now() }) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing svix headers" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 5 * 60) return { ok: false, reason: "timestamp outside tolerance" };
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  for (const part of signature.split(/\s+/)) {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true, id };
  }
  return { ok: false, reason: "signature mismatch" };
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------
export function parseAddress(s) {
  const v = String(s || "").trim();
  const m = /^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/.exec(v);
  const email = (m ? m[2] : v).trim().toLowerCase();
  const name = m ? m[1].trim() : "";
  return { email, name, domain: email.split("@")[1] || "" };
}

export function parseAddressList(v) {
  if (!v) return [];
  const items = Array.isArray(v) ? v : String(v).split(",");
  return items.map(parseAddress).filter((a) => a.email.includes("@"));
}

// ---------------------------------------------------------------------------
// Raw message headers (for DKIM signing domains and threading when the JSON lacks them)
// ---------------------------------------------------------------------------
export function parseRawHeaders(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const end = text.indexOf("\n\n");
  const block = end === -1 ? text : text.slice(0, end);
  const lines = block.split("\n");
  const out = {};
  let current = null;
  for (const line of lines) {
    if (/^[ \t]/.test(line) && current) {
      out[current][out[current].length - 1] += " " + line.trim();
      continue;
    }
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    current = m[1].toLowerCase();
    (out[current] ||= []).push(m[2]);
  }
  return out;
}

/** The d= domains of every DKIM-Signature header, lower-cased. */
export function dkimDomains(rawHeaders) {
  const sigs = rawHeaders["dkim-signature"] || [];
  return sigs.map((s) => /(?:^|;)\s*d=([^;\s]+)/i.exec(s)?.[1]?.toLowerCase()).filter(Boolean);
}

export function firstHeader(h, name) {
  const v = h?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

// ---------------------------------------------------------------------------
// Auto-replies, bounces, the agent's own mail
// ---------------------------------------------------------------------------
export function isAutomatedMail({ from, subject, headers }) {
  const h = (name) => String(firstHeader(headers, name) || "").toLowerCase();
  if (h("auto-submitted") && h("auto-submitted") !== "no") return "auto-submitted";
  if (h("x-autoreply") || h("x-autorespond") || h("x-auto-response-suppress")) return "auto-reply header";
  if (/^(bulk|auto_reply|junk|list)$/.test(h("precedence"))) return "precedence";
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i.test(from.email)) return "bounce or no-reply sender";
  if (/^(auto(matic)?[\s-]*reply|out of (the )?office|automatic response|delivery (status|failure)|undeliverable)/i.test(String(subject || ""))) return "auto-reply subject";
  if (h("content-type").includes("multipart/report")) return "delivery report";
  return null;
}

// ---------------------------------------------------------------------------
// Fetching a received email. Returns one normalized shape whatever the source.
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 15_000;

async function api(path, init = {}) {
  const { resendKey } = agentConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${resendKey}`, "User-Agent": UA, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`Resend ${init.method || "GET"} ${path} failed (${res.status}): ${data?.message || data?.error || "unknown"}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Normalized email:
 * { id, messageId, from:{email,name,domain}, to:[], cc:[], subject, text, html, headers (lowercase map of first
 *   values), inReplyTo, references:[], auth:{spf,dkim,dmarc}, dkimDomains:[], attachments:[{filename, size}] }
 */
export async function fetchReceivedEmail(emailId, inline) {
  if (inline && agentSandbox()) return normalize(inline, {});
  const t0 = Date.now();
  const data = await api(`/emails/receiving/${emailId}`);
  console.log(`[eib agent] resend fetch email: ${Date.now() - t0} ms`);
  let rawHeaders = {};
  if (data?.raw?.download_url) {
    const t1 = Date.now();
    try {
      const res = await fetch(data.raw.download_url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) rawHeaders = parseRawHeaders(await res.text());
      console.log(`[eib agent] resend raw download: ${Date.now() - t1} ms (${Object.keys(rawHeaders).length} headers)`);
    } catch (e) {
      console.warn(`[eib agent] resend raw download failed after ${Date.now() - t1} ms: ${e?.message || e}; using JSON headers only`);
      rawHeaders = {};
    }
  }
  return normalize(data, rawHeaders);
}

function normalize(data, rawHeaders) {
  const headers = {};
  for (const [k, v] of Object.entries(data.headers || {})) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  for (const [k, v] of Object.entries(rawHeaders)) if (!(k in headers)) headers[k] = v[0] ?? "";
  const from = parseAddress(headers.from || data.from);
  const references = String(headers.references || "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // The plain-text part keeps the quoted chain; an HTML-only email gets it converted with the quotes kept.
  const text = String(data.text || "") || htmlToText(data.html || "", { keepQuotes: true });
  // Resend's `to` is the envelope recipient (the agent's own address), not the To line the sender wrote.
  // The header To and Cc say who the email was really addressed to, which decides CC mode.
  const headerTo = parseAddressList(headers.to);
  const headerCc = parseAddressList(headers.cc);
  return {
    id: data.id || data.email_id || "",
    messageId: String(data.message_id || headers["message-id"] || "").trim(),
    from,
    to: headerTo.length ? headerTo : parseAddressList(data.to),
    cc: headerCc.length ? headerCc : parseAddressList(data.cc),
    subject: String(data.subject || headers.subject || ""),
    text: stripQuotedReply(text),
    fullText: text,
    quoted: quotedPart(text),
    html: data.html || "",
    headers,
    inReplyTo: String(headers["in-reply-to"] || "").trim(),
    references,
    auth: { spf: data.authentication?.spf || "unknown", dkim: data.authentication?.dkim || "unknown", dmarc: data.authentication?.dmarc || "unknown" },
    dkimDomains: dkimDomains(rawHeaders),
    attachments: (data.attachments || []).map((a) => ({ filename: a.filename, size: a.size, contentType: a.content_type })),
  };
}

export function htmlToText(html, { keepQuotes = false } = {}) {
  let h = String(html || "").replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "");
  // Gmail, Outlook and Apple Mail wrap the quoted earlier message in a marked block: drop it whole, unless
  // the caller wants the whole chain (for context and thread matching).
  if (!keepQuotes) {
    h = h
      .replace(/<div[^>]*class="[^"]*\b(gmail_quote|moz-cite-prefix|yahoo_quoted)\b[^"]*"[\s\S]*$/i, "")
      .replace(/<div[^>]*id="(divRplyFwdMsg|appendonsend)"[\s\S]*$/i, "")
      .replace(/<blockquote[^>]*type="cite"[\s\S]*$/i, "");
  }
  return h
    .replace(/<blockquote[^>]*>/gi, "\n> ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The sender's new words only: cut at the first quoted-reply marker. */
export function stripQuotedReply(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // "On <date> <person> wrote:" even when the quoted text continues on the same line (HTML conversions).
    if (/^On\b.{0,300}\bwrote:/.test(t) || /^Le\b.{0,300}a écrit\s*:/.test(t)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(t)) break;
    if (/^From:\s.+/.test(t) && out.length > 0 && /^(Sent|Date):/.test((lines[i + 1] || "").trim())) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/** The quoted earlier messages under the sender's own words (everything from the first quote marker on). */
export function quotedPart(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^On\b.{0,300}\bwrote:/.test(t) || /^Le\b.{0,300}a écrit\s*:/.test(t) || /^-{2,}\s*Original Message\s*-{2,}/i.test(t) || lines[i].startsWith(">") || (/^From:\s.+/.test(t) && i > 0 && /^(Sent|Date):/.test((lines[i + 1] || "").trim()))) {
      return lines
        .slice(i)
        .map((l) => l.replace(/^(>\s?)+/, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 8000);
    }
  }
  return "";
}

/** The first non-empty line of the sender's own text, for yes/no decisions. */
export function firstLineOf(text) {
  return (
    String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) || ""
  );
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The HTML twin of a plain-text email: same words, paragraphs kept, URLs clickable, and "References:" lines
 * ("- Title: https://...") shown as links with the title as the link text.
 */
export function textToHtml(text) {
  const paragraphs = String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = paragraphs
    .map((p) => {
      const lines = p.split("\n").map((line) => {
        const ref = /^(- )?(.+?): (https?:\/\/\S+)$/.exec(line.trim());
        if (ref) return `${ref[1] ? "&bull; " : ""}<a href="${escapeHtml(ref[3])}">${escapeHtml(ref[2])}</a>`;
        return escapeHtml(line).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1">$1</a>');
      });
      return `<p style="margin:0 0 14px">${lines.join("<br>")}</p>`;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a">${html}</div>`;
}

export async function sendMail({ to, cc = [], subject, text, html, inReplyTo, references = [] }) {
  const cfg = agentConfig();
  const from = `${cfg.displayName} <${cfg.address}>`;
  // Josef is on every email the agent sends, unless he is already in To or CC. Never duplicated.
  const toList = [].concat(to).map((e) => String(e).toLowerCase());
  const josef = cfg.josefAddresses[0];
  cc = [...new Set([].concat(cc).map((e) => String(e).toLowerCase()).filter((e) => e && e !== cfg.address && !toList.includes(e)))];
  if (josef && !toList.includes(josef) && !cc.includes(josef)) cc.push(josef);
  to = toList;
  const headers = {};
  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
    headers["References"] = [...references, inReplyTo].filter((v, i, a) => v && a.indexOf(v) === i).join(" ");
  }
  const payload = { from, to: [].concat(to), cc: cc.length ? cc : undefined, subject, text, html: html || textToHtml(text), headers: Object.keys(headers).length ? headers : undefined };
  if (!cfg.resendKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set; the agent cannot send.");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "data", "agent-outbox.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const id = `<local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@sandbox>`;
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), messageId: id, ...payload }) + "\n");
    console.log(`[eib agent → outbox] to ${payload.to.join(", ")}: ${subject}`);
    return { id, messageId: id };
  }
  const t0 = Date.now();
  const data = await api("/emails", { method: "POST", body: JSON.stringify(payload), headers: { "Idempotency-Key": crypto.randomUUID() } });
  console.log(`[eib agent] resend send to ${payload.to.join(",")}: ${Date.now() - t0} ms (id ${data?.id})`);
  return { id: data?.id, messageId: `<${data?.id}@${cfg.address.split("@")[1]}>` };
}

export function reSubject(subject) {
  const s = String(subject || "").trim();
  return /^re:/i.test(s) ? s : `Re: ${s || "(no subject)"}`;
}
