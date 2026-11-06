// Forwarded emails from Josef ("handle this", "reply saying X"). Parses the forwarded block out of the body.

import { parseAddress } from "./mail";

const MARKERS = [
  /^-{3,}\s*Forwarded message\s*-{3,}\s*$/im,
  /^Begin forwarded message:\s*$/im,
  /^-{3,}\s*Original Message\s*-{3,}\s*$/im,
  /^(?:De|From)\s*:\s.+\n(?:(?:Envoy[ée]|Sent|Date)\s*:\s.+\n)/im,
];

/**
 * Returns null when the email is not a forward. Otherwise:
 * { instruction, original: { from: {email,name}, subject, body } }
 */
export function parseForward(email) {
  const text = String(email.fullText || "").replace(/\r\n/g, "\n");
  let idx = -1;
  for (const re of MARKERS) {
    const m = re.exec(text);
    if (m && (idx === -1 || m.index < idx)) idx = m.index;
  }
  if (idx === -1 && !/^fwd?\s*:/i.test(email.subject || "")) return null;
  const instruction = (idx === -1 ? "" : text.slice(0, idx)).replace(/^>+\s?/gm, "").trim();
  const block = idx === -1 ? text : text.slice(idx);
  const lines = block.split("\n").map((l) => l.replace(/^>+\s?/, ""));
  const header = {};
  let bodyStart = 0;
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(From|De|Sent|Date|Envoy[ée]|Subject|Objet|To|À|Cc)\s*:\s*(.*)$/i.exec(lines[i]);
    if (m) {
      const key = m[1].toLowerCase();
      header[key === "de" ? "from" : key === "objet" ? "subject" : key === "envoyé" || key === "envoye" ? "date" : key === "à" ? "to" : key] = m[2].trim();
      seen += 1;
      bodyStart = i + 1;
      continue;
    }
    if (seen && lines[i].trim() === "") {
      bodyStart = i + 1;
      break;
    }
  }
  if (!header.from) return null;
  const from = parseAddress(header.from.replace(/\s*\[mailto:[^\]]+\]/i, ""));
  const subject = (header.subject || String(email.subject || "").replace(/^\s*(fwd?|tr)\s*:\s*/i, "")).trim();
  const body = lines.slice(bodyStart).join("\n").trim();
  return { instruction, original: { from, subject, body } };
}
