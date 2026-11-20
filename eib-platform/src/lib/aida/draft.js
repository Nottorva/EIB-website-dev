// Deliverables AIDA writes out in the chat.
//
// AIDA wraps a deliverable it has written in two marker lines (see CARD_NOTE in context.js):
//
//   [[draft:ID]]
//   the answer
//   [[/draft]]
//
// The chat shows that part in a box with an "Add to 1A" button, which puts it into the student's
// deliverable. A written answer is the text as it stands. A table is one line per row, cells separated
// by " | ", each line starting with the row's name when the table has named rows.
// No imports: this is used by the chat box in the browser and by the smoke suite.

const OPEN = /\[\[draft:([^\]\s]+)\]\][ \t]*\r?\n?/g;
const CLOSE = "[[/draft]]";
// A marker still arriving at the very end of a reply that is being written.
const HALF = /\[\[[^\]]*\]?$/;

/**
 * A reply as the parts to show, in order: { text } and { draft: { id, body, done } }.
 * `done` is false while the closing marker has not arrived yet.
 */
export function splitReply(content) {
  const s = String(content || "");
  const parts = [];
  let at = 0;
  OPEN.lastIndex = 0;
  for (let m; (m = OPEN.exec(s)); ) {
    if (m.index > at) parts.push({ text: s.slice(at, m.index) });
    const start = m.index + m[0].length;
    const end = s.indexOf(CLOSE, start);
    const done = end >= 0;
    const body = (done ? s.slice(start, end) : s.slice(start).replace(HALF, "")).trim();
    parts.push({ draft: { id: m[1], body, done } });
    at = done ? end + CLOSE.length : s.length;
    OPEN.lastIndex = at;
  }
  if (at < s.length) parts.push({ text: s.slice(at) });
  return parts;
}

const norm = (v) => String(v || "").trim().toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, " ").trim();
export const tableColumns = (item) => (item.columns?.length ? item.columns : ["Column 1", "Column 2"]);

// The cells of one line. Anything past the last column stays in the last cell.
function fit(cells, width) {
  const out = cells.slice(0, width);
  if (cells.length > width) out[width - 1] = cells.slice(width - 1).join(" | ");
  while (out.length < width) out.push("");
  return out;
}

/** The answer a draft would put into a deliverable, or null when it cannot be one (links, checklists, nothing written). */
export function draftPayload(item, body) {
  const text = String(body || "").trim();
  if (!item || !text) return null;
  if (item.type === "text") return { text };
  if (item.type !== "table") return null;

  const columns = tableColumns(item);
  const rowLabels = item.rowLabels?.length ? item.rowLabels : [];
  const header = columns.map(norm).join("|");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, ""))
    .filter((l) => l && !/^[\s|:-]+$/.test(l))
    .map((l) => l.split("|").map((c) => c.trim()))
    // a header line, should AIDA write one
    .filter((cells) => ![cells, cells.slice(1)].some((c) => c.map(norm).join("|") === header));
  if (!lines.length) return null;

  if (!rowLabels.length) return { columns, rowLabels, rows: lines.map((cells) => fit(cells, columns.length)) };

  const rows = rowLabels.map(() => columns.map(() => ""));
  const names = rowLabels.map(norm);
  const used = new Set();
  lines.forEach((cells, n) => {
    let i = names.findIndex((name, k) => !used.has(k) && name === norm(cells[0]));
    // Named: the rest are the cells. Not named: take the line's place in the order.
    const rest = i >= 0 || cells.length > columns.length ? cells.slice(1) : cells;
    if (i < 0) i = !used.has(n) && n < rows.length ? n : -1;
    if (i < 0) return;
    used.add(i);
    rows[i] = fit(rest, columns.length);
  });
  return rows.some((r) => r.some(Boolean)) ? { columns, rowLabels, rows } : null;
}

/** Is this already what the deliverable holds? */
export function sameAnswer(item, a, b) {
  if (!a || !b) return false;
  if (item.type === "text") return String(a.text || "").trim() === String(b.text || "").trim();
  const flat = (p) => JSON.stringify((p.rows || []).map((r) => r.map((c) => String(c || "").trim())).filter((r) => r.some(Boolean)));
  return flat(a) === flat(b);
}
