// Local sandbox data store (used when MONGODB_URI is not set).
//
// A single JSON file (data/db.json) holding the same collections the MongoDB
// store uses, plus a `settings` map. Same function signatures as
// store.mongo.js; store.js picks one at runtime.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sampleSeed } from "./seed";

// On Vercel (and other read-only hosts) the project folder cannot be written
// to, so the sandbox file lives in the temp directory instead. It is wiped on
// every deploy and not shared between serverless instances: fine for a look,
// useless for real data. Set MONGODB_URI for anything that must persist.
const DB_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), "eib-sandbox", "db.json")
  : path.join(process.cwd(), "data", "db.json");

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(sampleSeed(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export async function findAll(collection, predicate) {
  const db = load();
  const rows = db[collection] || [];
  return predicate ? rows.filter(predicate) : rows;
}

export async function findOne(collection, predicate) {
  const rows = await findAll(collection, predicate);
  return rows[0] || null;
}

export async function findById(collection, id) {
  return findOne(collection, (r) => r.id === id);
}

export async function insert(collection, doc) {
  const db = load();
  db[collection] = db[collection] || [];
  db[collection].push(doc);
  save(db);
  return doc;
}

// Shallow-merges `patch` into the document with this id.
export async function updateOne(collection, id, patch) {
  const db = load();
  const rows = db[collection] || [];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, id };
  save(db);
  return rows[idx];
}

export async function replaceOne(collection, id, doc) {
  const db = load();
  const rows = db[collection] || [];
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...doc, id };
  save(db);
  return rows[idx];
}

export async function removeOne(collection, id) {
  const db = load();
  const before = (db[collection] || []).length;
  db[collection] = (db[collection] || []).filter((r) => r.id !== id);
  save(db);
  return db[collection].length < before;
}

export async function getSetting(key) {
  const db = load();
  return db.settings?.[key];
}

export async function setSetting(key, value) {
  const db = load();
  db.settings = db.settings || {};
  db.settings[key] = value;
  save(db);
  return value;
}
