// The "EIB Documents" Google Drive folder: titles and contents of every file, read through a service account
// (no googleapis package: the key signs a JWT, Google trades it for a token, and we call the REST APIs).
//
//   listFiles()            every file in the folder (one level of subfolders), cached for a few minutes
//   readFile(file)         its contents in one normalised shape: paragraphs, tables (Docs), grids (Sheets)
//   readmeContext()        the "Read me" / "Additional information" docs, for the model's standing context
//   searchDocuments(q)     title + content search with snippets
//   readDocument(title)    the full text of one file
//   applyDocumentEdit(s)   one approved edit: replace text, set a table cell, set a sheet cell
//
// Local sandbox (no service account): a fake folder in data/fake-drive.json with the same shape, so the
// smoke suite can read and edit documents without Google.

import crypto from "node:crypto";
import { agentConfig, agentSandbox } from "./config";
import { getSetting } from "../data/store";

const g = globalThis;
const LIST_TTL_MS = 3 * 60_000;
const SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets";
const MIME = {
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
  folder: "application/vnd.google-apps.folder",
};
const README_RE = /\b(read ?me|additional (info|information)|how i keep|conventions|notes? (for|to) (the )?assistant|assistant notes)\b/i;
export const DEFAULT_EDIT_FILTER = "test";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function driveConfigured() {
  const { serviceAccountJson, driveFolderId } = agentConfig();
  return Boolean(serviceAccountJson && driveFolderId) || useFake();
}

const useFake = () => !agentConfig().serviceAccountJson && agentSandbox();

async function accessToken() {
  const { serviceAccountJson } = agentConfig();
  if (!serviceAccountJson) return null;
  const cached = g.__eibDriveToken;
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const jwt = `${header}.${claims}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${data.error_description || data.error}`);
  g.__eibDriveToken = { token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

async function gapi(url, { method = "GET", body, timeout = 15_000 } = {}) {
  const token = await accessToken();
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`Google API error ${res.status}: ${data?.error?.message || String(text).slice(0, 200)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
async function listFolder(folderId, depth) {
  const params = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, fields: "files(id,name,mimeType,modifiedTime,webViewLink)", pageSize: "200", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  const data = await gapi(`https://www.googleapis.com/drive/v3/files?${params}`);
  const files = [];
  for (const f of data.files || []) {
    if (f.mimeType === MIME.folder) {
      if (depth > 0) files.push(...(await listFolder(f.id, depth - 1)));
    } else files.push({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, link: f.webViewLink });
  }
  return files;
}

/** Every file in the folder. Cached for a few minutes per server instance; `fresh` forces a reload. */
export async function listFiles({ fresh = false } = {}) {
  if (useFake()) return (await fakeFiles()).map(({ id, name, mimeType, modifiedTime, link }) => ({ id, name, mimeType, modifiedTime, link }));
  const { driveFolderId, serviceAccountJson } = agentConfig();
  if (!driveFolderId || !serviceAccountJson) return [];
  const cache = g.__eibDriveList;
  if (!fresh && cache && cache.at > Date.now() - LIST_TTL_MS) return cache.files;
  const t = Date.now();
  const files = await listFolder(driveFolderId, 1);
  console.log(`[eib agent] drive list: ${files.length} file(s) in ${Date.now() - t} ms`);
  g.__eibDriveList = { at: Date.now(), files };
  return files;
}

export function lastListedAt() {
  return g.__eibDriveList?.at ? new Date(g.__eibDriveList.at).toISOString() : null;
}

// ---------------------------------------------------------------------------
// Reading: one shape for every kind of file
//   { ...file, kind: "doc"|"sheet"|"slides"|"text"|"other", text, blocks, sheets, readable }
//   blocks  (docs)   [{ type: "paragraph", text, start, end } | { type: "table", index, rows: [[{ text, start, end }]] }]
//   sheets  (sheets) [{ title, rows: [[string]] }]
// ---------------------------------------------------------------------------
function kindOf(mimeType) {
  if (mimeType === MIME.doc) return "doc";
  if (mimeType === MIME.sheet) return "sheet";
  if (mimeType === MIME.slides) return "slides";
  if (/^text\/|markdown|csv|json/.test(mimeType || "")) return "text";
  return "other";
}

const cellText = (cell) =>
  (cell.content || [])
    .map((el) => (el.paragraph?.elements || []).map((e) => e.textRun?.content || "").join(""))
    .join("")
    .replace(/\n+$/, "")
    .trim();

/** Google Docs API body -> blocks. Table cells keep their index range so a cell can be rewritten. */
function parseDocBody(doc) {
  const blocks = [];
  let tables = 0;
  for (const el of doc.body?.content || []) {
    if (el.paragraph) {
      const text = (el.paragraph.elements || []).map((e) => e.textRun?.content || "").join("").replace(/\n$/, "");
      if (text.trim()) blocks.push({ type: "paragraph", text, start: el.startIndex, end: el.endIndex });
    } else if (el.table) {
      tables += 1;
      const rows = (el.table.tableRows || []).map((r) =>
        (r.tableCells || []).map((c) => {
          const paras = (c.content || []).filter((x) => x.paragraph);
          const first = paras[0];
          const last = paras[paras.length - 1];
          return { text: cellText(c), start: first?.startIndex ?? c.startIndex, end: last?.endIndex ?? c.endIndex };
        }),
      );
      blocks.push({ type: "table", index: tables, rows, start: el.startIndex, end: el.endIndex });
    }
  }
  return blocks;
}

/** Plain-text rendering with table and row markers the model can refer to ("table 1, row 3, column 2"). */
export function renderBlocks(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (b.type === "paragraph") out.push(b.text);
    else {
      out.push(`[Table ${b.index}]`);
      b.rows.forEach((row, i) => out.push(`Row ${i + 1}: ${row.map((c) => c.text || "(empty)").join(" | ")}`));
    }
  }
  return out.join("\n");
}

function renderSheets(sheets) {
  return (sheets || [])
    .map((s) => `[Sheet "${s.title}"]\n${s.rows.map((r, i) => `Row ${i + 1}: ${r.map((c) => c || "(empty)").join(" | ")}`).join("\n")}`)
    .join("\n\n");
}

async function readGoogleDoc(file) {
  const doc = await gapi(`https://docs.googleapis.com/v1/documents/${file.id}`);
  const blocks = parseDocBody(doc);
  return { ...file, kind: "doc", readable: true, blocks, sheets: [], text: renderBlocks(blocks) };
}

async function readGoogleSheet(file) {
  const meta = await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties.title`);
  const sheets = [];
  for (const s of (meta.sheets || []).slice(0, 10)) {
    const title = s.properties.title;
    const v = await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(`'${title}'`)}`);
    sheets.push({ title, rows: (v.values || []).slice(0, 300).map((r) => r.map((c) => String(c ?? ""))) });
  }
  return { ...file, kind: "sheet", readable: true, blocks: [], sheets, text: renderSheets(sheets) };
}

async function readExport(file, kind) {
  const url = kind === "slides" ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain` : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  const data = await gapi(url);
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return { ...file, kind, readable: true, blocks: [], sheets: [], text: text.slice(0, 60_000) };
}

/** Contents of one file, cached by id + modifiedTime. Unreadable kinds (PDF, Word) come back with readable: false. */
export async function readFile(file) {
  if (useFake()) {
    const f = (await fakeFiles()).find((x) => x.id === file.id);
    if (!f) throw new Error(`No such document: ${file.name}`);
    return { ...f, readable: true, text: f.kind === "sheet" ? renderSheets(f.sheets) : renderBlocks(f.blocks) };
  }
  const cache = (g.__eibDriveContent ||= new Map());
  const hit = cache.get(file.id);
  if (hit && hit.modifiedTime === file.modifiedTime) return hit.content;
  const kind = kindOf(file.mimeType);
  let content;
  const t = Date.now();
  if (kind === "doc") content = await readGoogleDoc(file);
  else if (kind === "sheet") content = await readGoogleSheet(file);
  else if (kind === "slides" || kind === "text") content = await readExport(file, kind);
  else content = { ...file, kind, readable: false, blocks: [], sheets: [], text: "" };
  console.log(`[eib agent] drive read "${file.name}" (${kind}): ${Date.now() - t} ms, ${content.text.length} chars`);
  cache.set(file.id, { modifiedTime: file.modifiedTime, content });
  return content;
}

// ---------------------------------------------------------------------------
// What the model gets
// ---------------------------------------------------------------------------
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (q) => norm(q).split(/[^a-z0-9]+/).filter((w) => w.length > 2);

export const isReadme = (file) => README_RE.test(file.name || "");

/** The standing notes Josef keeps in the folder ("Read me", "Additional information", "How I keep things"). */
export async function readmeContext() {
  if (!driveConfigured()) return "";
  let files;
  try {
    files = (await listFiles()).filter(isReadme);
  } catch (e) {
    console.error(`[eib agent] readme list failed: ${e.message}`);
    return "";
  }
  const parts = [];
  let budget = 12_000;
  for (const f of files) {
    try {
      const c = await readFile(f);
      if (!c.readable || !c.text.trim()) continue;
      const text = c.text.slice(0, budget);
      budget -= text.length;
      parts.push(`<document title="${f.name}">\n${text}\n</document>`);
      if (budget <= 0) break;
    } catch (e) {
      console.error(`[eib agent] readme read failed for ${f.name}: ${e.message}`);
    }
  }
  return parts.length ? `<folder_notes>\nJosef keeps these notes in the EIB Documents folder. They are the house rules and standing facts; follow them.\n${parts.join("\n")}\n</folder_notes>` : "";
}

function snippetsFor(text, qs) {
  const lines = String(text || "").split("\n");
  const out = [];
  for (const line of lines) {
    const l = norm(line);
    if (qs.some((w) => l.includes(w))) out.push(line.trim().slice(0, 240));
    if (out.length >= 4) break;
  }
  return out;
}

/** Files whose title or contents match the words, best first, with snippets and links. */
export async function searchDocuments(query) {
  if (!driveConfigured()) return { configured: false, files: [] };
  const qs = words(query);
  const files = await listFiles();
  const scored = [];
  for (const f of files) {
    const nameScore = qs.reduce((n, w) => n + (norm(f.name).includes(w) ? 3 : 0), 0);
    let content = null;
    try {
      content = await readFile(f);
    } catch (e) {
      console.error(`[eib agent] drive read failed for ${f.name}: ${e.message}`);
    }
    const body = content?.readable ? norm(content.text) : "";
    const bodyScore = qs.reduce((n, w) => n + (body.includes(w) ? 1 : 0), 0);
    const score = nameScore + bodyScore;
    if (!qs.length || score > 0) scored.push({ file: f, content, score });
  }
  scored.sort((a, b) => b.score - a.score || String(b.file.modifiedTime).localeCompare(String(a.file.modifiedTime)));
  return {
    configured: true,
    files: scored.slice(0, 5).map(({ file, content }) => ({
      title: file.name,
      modified: String(file.modifiedTime).slice(0, 10),
      link: file.link,
      readable: Boolean(content?.readable),
      snippets: content?.readable ? snippetsFor(content.text, qs) : ["(contents not readable: only the title is searchable)"],
    })),
  };
}

/** Find one file by title (exact, then loose). */
export async function findFile(title) {
  const files = await listFiles();
  const t = norm(title);
  const exact = files.find((f) => norm(f.name) === t);
  if (exact) return { file: exact, candidates: [] };
  const loose = files.filter((f) => norm(f.name).includes(t) || t.includes(norm(f.name)) || words(title).every((w) => norm(f.name).includes(w)));
  if (loose.length === 1) return { file: loose[0], candidates: [] };
  return { file: null, candidates: loose };
}

/** The full text of one file, for the model. */
export async function readDocument(title) {
  if (!driveConfigured()) return { error: "The documents folder is not connected yet." };
  const { file, candidates } = await findFile(title);
  if (!file) return { error: candidates.length ? `Which one? ${candidates.map((c) => c.name).join("; ")}` : `No document titled "${title}" in the EIB Documents folder.` };
  const c = await readFile(file);
  if (!c.readable) return { title: file.name, link: file.link, note: "This file type cannot be read (PDF or Word). Only its title is known." };
  return { title: file.name, link: file.link, modified: String(file.modifiedTime).slice(0, 10), kind: c.kind, text: c.text.slice(0, 20_000) };
}

// ---------------------------------------------------------------------------
// Editing (only documents whose title passes the edit filter)
// ---------------------------------------------------------------------------
/** Comma-separated words; a document may be edited when its title contains one of them. Empty = any document. */
export async function editFilter() {
  const v = await getSetting("agentDocEditFilter");
  return v === undefined || v === null ? DEFAULT_EDIT_FILTER : String(v);
}

export function titlePassesFilter(name, filter) {
  const ws = String(filter || "")
    .split(/[,\s]+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (!ws.length) return true;
  const n = String(name || "").toLowerCase();
  return ws.some((w) => n.includes(w));
}

export async function editableFiles() {
  const filter = await editFilter();
  return (await listFiles()).filter((f) => titlePassesFilter(f.name, filter) && ["doc", "sheet"].includes(kindOf(f.mimeType)));
}

const cellRef = (a1) => {
  const m = /^([A-Z]+)(\d+)$/i.exec(String(a1 || "").trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
};

/**
 * Check one proposed document edit against the live document. Returns { ok, file, before, problem, count }.
 *   edit: "replace_text" (find/replace), "table_cell" (table/row/column/new_text), "sheet_cell" (sheet/cell/new_text)
 */
export async function checkDocumentEdit(step) {
  if (!driveConfigured()) return { ok: false, problem: "The documents folder is not connected." };
  const { file, candidates } = await findFile(step.document);
  if (!file) return { ok: false, problem: candidates.length ? `Several documents match "${step.document}": ${candidates.map((c) => c.name).join("; ")}.` : `No document titled "${step.document}".` };
  const filter = await editFilter();
  if (!titlePassesFilter(file.name, filter)) return { ok: false, file, problem: `"${file.name}" is outside the documents I may edit right now (titles containing: ${filter}).` };
  const c = await readFile(file);
  if (!c.readable) return { ok: false, file, problem: `"${file.name}" cannot be edited (PDF or Word). It needs a manual change.` };
  if (step.edit === "replace_text") {
    if (c.kind !== "doc") return { ok: false, file, problem: `Text replacement works on Google Docs; "${file.name}" is a ${c.kind}.` };
    const find = String(step.find || "");
    if (!find.trim()) return { ok: false, file, problem: "No text to find." };
    const count = c.text.split(find).length - 1;
    if (!count) return { ok: false, file, problem: `"${find}" does not appear in "${file.name}".` };
    return { ok: true, file, before: find, after: String(step.replace || ""), count };
  }
  if (step.edit === "table_cell") {
    if (c.kind !== "doc") return { ok: false, file, problem: `"${file.name}" is a ${c.kind}; use a sheet cell edit for spreadsheets.` };
    const table = c.blocks.find((b) => b.type === "table" && b.index === Number(step.table));
    if (!table) return { ok: false, file, problem: `"${file.name}" has no table ${step.table}.` };
    const row = table.rows[Number(step.row) - 1];
    const cell = row?.[Number(step.column) - 1];
    if (!cell) return { ok: false, file, problem: `Table ${step.table} in "${file.name}" has no row ${step.row}, column ${step.column}.` };
    return { ok: true, file, before: cell.text, after: String(step.new_text || ""), count: 1 };
  }
  if (step.edit === "sheet_cell") {
    if (c.kind !== "sheet") return { ok: false, file, problem: `"${file.name}" is not a spreadsheet.` };
    const sheet = c.sheets.find((s) => norm(s.title) === norm(step.sheet)) || c.sheets[0];
    const ref = cellRef(step.cell);
    if (!sheet || !ref) return { ok: false, file, problem: `Cell "${step.cell}" on sheet "${step.sheet}" was not found in "${file.name}".` };
    const before = sheet.rows[ref.row - 1]?.[ref.col - 1] ?? "";
    return { ok: true, file, before, after: String(step.new_text || ""), count: 1, sheetTitle: sheet.title };
  }
  return { ok: false, file, problem: `Unknown edit type "${step.edit}".` };
}

/** Apply one checked edit. Re-checks first so a document changed since the ticket was written is not clobbered. */
export async function applyDocumentEdit(step) {
  const chk = await checkDocumentEdit(step);
  if (!chk.ok) throw new Error(chk.problem);
  if (chk.before !== step.before && step.edit !== "replace_text") throw new Error(`"${chk.file.name}" changed since the plan was made (now "${chk.before}"). Not applied.`);
  const file = chk.file;
  if (useFake()) return fakeApply(file, step, chk);
  if (step.edit === "replace_text") {
    const r = await gapi(`https://docs.googleapis.com/v1/documents/${file.id}:batchUpdate`, { method: "POST", body: { requests: [{ replaceAllText: { containsText: { text: step.find, matchCase: true }, replaceText: step.replace } }] } });
    invalidate(file.id);
    const n = r.replies?.[0]?.replaceAllText?.occurrencesChanged ?? chk.count;
    return `Replaced "${step.find}" with "${step.replace}" in "${file.name}" (${n} place${n === 1 ? "" : "s"}).`;
  }
  if (step.edit === "table_cell") {
    const c = await readFile(file);
    const table = c.blocks.find((b) => b.type === "table" && b.index === Number(step.table));
    const cell = table.rows[Number(step.row) - 1][Number(step.column) - 1];
    const requests = [];
    // A cell's last newline cannot be deleted; everything before it can.
    if (cell.end - 1 > cell.start) requests.push({ deleteContentRange: { range: { startIndex: cell.start, endIndex: cell.end - 1 } } });
    if (String(step.new_text || "").length) requests.push({ insertText: { location: { index: cell.start }, text: String(step.new_text) } });
    if (requests.length) await gapi(`https://docs.googleapis.com/v1/documents/${file.id}:batchUpdate`, { method: "POST", body: { requests } });
    invalidate(file.id);
    return `"${file.name}", table ${step.table}, row ${step.row}, column ${step.column}: "${chk.before || "(empty)"}" is now "${step.new_text}".`;
  }
  if (step.edit === "sheet_cell") {
    const range = `'${chk.sheetTitle}'!${String(step.cell).toUpperCase()}`;
    await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: { range, majorDimension: "ROWS", values: [[String(step.new_text || "")]] } });
    invalidate(file.id);
    return `"${file.name}", sheet "${chk.sheetTitle}", cell ${String(step.cell).toUpperCase()}: "${chk.before || "(empty)"}" is now "${step.new_text}".`;
  }
  throw new Error(`Unknown edit type "${step.edit}".`);
}

function invalidate(fileId) {
  g.__eibDriveContent?.delete(fileId);
  g.__eibDriveList = null;
}

// ---------------------------------------------------------------------------
// Sandbox: a fake folder on disk
// ---------------------------------------------------------------------------
async function fakeIo() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  return { fs, file: path.join(process.cwd(), "data", "fake-drive.json"), dir: path.join(process.cwd(), "data") };
}

async function fakeFiles() {
  const { fs, file, dir } = await fakeIo();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(FAKE_SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function fakeSave(files) {
  const { fs, file } = await fakeIo();
  fs.writeFileSync(file, JSON.stringify(files, null, 2));
}

async function fakeApply(file, step, chk) {
  const files = await fakeFiles();
  const f = files.find((x) => x.id === file.id);
  if (step.edit === "replace_text") {
    let n = 0;
    for (const b of f.blocks) {
      if (b.type === "paragraph" && b.text.includes(step.find)) {
        n += b.text.split(step.find).length - 1;
        b.text = b.text.split(step.find).join(step.replace);
      }
      if (b.type === "table") for (const row of b.rows) for (const c of row) if (c.text.includes(step.find)) {
        n += c.text.split(step.find).length - 1;
        c.text = c.text.split(step.find).join(step.replace);
      }
    }
    f.modifiedTime = new Date().toISOString();
    await fakeSave(files);
    return `Replaced "${step.find}" with "${step.replace}" in "${file.name}" (${n} place${n === 1 ? "" : "s"}).`;
  }
  if (step.edit === "table_cell") {
    const table = f.blocks.find((b) => b.type === "table" && b.index === Number(step.table));
    table.rows[Number(step.row) - 1][Number(step.column) - 1].text = String(step.new_text || "");
    f.modifiedTime = new Date().toISOString();
    await fakeSave(files);
    return `"${file.name}", table ${step.table}, row ${step.row}, column ${step.column}: "${chk.before || "(empty)"}" is now "${step.new_text}".`;
  }
  const sheet = f.sheets.find((s) => s.title === chk.sheetTitle);
  const ref = cellRef(step.cell);
  while (sheet.rows.length < ref.row) sheet.rows.push([]);
  while (sheet.rows[ref.row - 1].length < ref.col) sheet.rows[ref.row - 1].push("");
  sheet.rows[ref.row - 1][ref.col - 1] = String(step.new_text || "");
  f.modifiedTime = new Date().toISOString();
  await fakeSave(files);
  return `"${file.name}", sheet "${chk.sheetTitle}", cell ${String(step.cell).toUpperCase()}: "${chk.before || "(empty)"}" is now "${step.new_text}".`;
}

const FAKE_SEED = [
  {
    id: "fake-readme",
    name: "Read me (test)",
    mimeType: MIME.doc,
    kind: "doc",
    modifiedTime: "2026-11-01T12:00:00.000Z",
    link: "https://docs.google.com/document/d/fake-readme",
    blocks: [
      { type: "paragraph", text: "How I keep things: in the Session schedule, a confirmed mentor is written as Name (confirmed). Parents park in the east lot after 6pm and use the Lawrence entrance." },
      { type: "paragraph", text: "EIB Night is the student pitch night; the venue is the library." },
    ],
    sheets: [],
  },
  {
    id: "fake-schedule",
    name: "Session schedule (test)",
    mimeType: MIME.doc,
    kind: "doc",
    modifiedTime: "2026-11-01T12:00:00.000Z",
    link: "https://docs.google.com/document/d/fake-schedule",
    blocks: [
      { type: "paragraph", text: "EIB session schedule, cohort 2026." },
      {
        type: "table",
        index: 1,
        rows: [
          [{ text: "Lesson" }, { text: "Date" }, { text: "Mentor" }],
          [{ text: "L2" }, { text: "Nov 10" }, { text: "TBD" }],
          [{ text: "L4" }, { text: "Nov 17" }, { text: "Owen Blackwood (confirmed)" }],
          [{ text: "EIB Night" }, { text: "Nov 17" }, { text: "Panel" }],
        ],
      },
    ],
    sheets: [],
  },
  {
    id: "fake-budget",
    name: "Budget (test)",
    mimeType: MIME.sheet,
    kind: "sheet",
    modifiedTime: "2026-11-01T12:00:00.000Z",
    link: "https://docs.google.com/spreadsheets/d/fake-budget",
    blocks: [],
    sheets: [{ title: "2026", rows: [["Item", "Amount"], ["Venue", "500"], ["Pizza", "200"]] }],
  },
  {
    id: "fake-runofshow",
    name: "EIB Night run of show",
    mimeType: MIME.doc,
    kind: "doc",
    modifiedTime: "2026-10-20T12:00:00.000Z",
    link: "https://docs.google.com/document/d/fake-runofshow",
    blocks: [{ type: "paragraph", text: "6:00 doors, 6:30 pitches, 7:30 awards. EIB Night is on Nov 17 in the library." }],
    sheets: [],
  },
];
