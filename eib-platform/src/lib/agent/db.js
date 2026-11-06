// The agent's data access. Three doors, on purpose:
//
//   bookkeeping  agent_processed, agent_threads, agent_escalations, agent_memory
//                -> the app's own store (MONGODB_URI, or the sandbox file)
//   readDomain   mentors, lessons, users, settings, events, applications
//                -> MONGODB_AGENT_READ_URI (the read-only Atlas user), else the app store
//   writeDomain  mentors and lessons only
//                -> MONGODB_AGENT_WRITE_URI (the write user), else the app store
//
// Only the edit path (verified Josef) ever calls writeDomain.

import { MongoClient } from "mongodb";
import * as store from "../data/store";
import { agentConfig } from "./config";

const dbName = process.env.MONGODB_DB || "eib";
const g = globalThis;

function client(key, uri) {
  const slot = `__eibAgentClient_${key}`;
  if (!g[slot]) {
    const t = Date.now();
    g[slot] = new MongoClient(uri, { maxPoolSize: 3, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 20000 })
      .connect()
      .then((c) => {
        console.log(`[eib agent] mongo ${key} connect: ${Date.now() - t} ms`);
        return c;
      })
      .catch((e) => {
        delete g[slot]; // let the next request try again instead of caching the failure
        throw new Error(`mongo ${key} connect failed after ${Date.now() - t} ms: ${e.message}`);
      });
  }
  return g[slot];
}

const strip = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

// ---------------------------------------------------------------------------
// Domain reads (read-only user)
// ---------------------------------------------------------------------------
const READABLE = new Set(["mentors", "lessons", "users", "settings", "events", "applications"]);

export async function readAll(collection) {
  if (!READABLE.has(collection)) throw new Error(`The agent may not read ${collection}.`);
  const { readUri } = agentConfig();
  if (!readUri) return store.findAll(collection);
  const c = await client("read", readUri);
  return (await c.db(dbName).collection(collection).find({}).toArray()).map(strip);
}

export async function readSetting(key) {
  const { readUri } = agentConfig();
  if (!readUri) return store.getSetting(key);
  const c = await client("read", readUri);
  const doc = await c.db(dbName).collection("settings").findOne({ _id: key });
  return doc ? doc.value : undefined;
}

// ---------------------------------------------------------------------------
// Domain writes (write user; mentors, lessons, and the application window setting; never deletes)
// ---------------------------------------------------------------------------
const WRITABLE = new Set(["mentors", "lessons"]);
const WRITABLE_SETTINGS = new Set(["applicationWindow", "applicationWindowAgentLastChange"]);

export async function writeSetting(key, value) {
  if (!WRITABLE_SETTINGS.has(key)) throw new Error(`The agent may not write setting ${key}.`);
  const { writeUri } = agentConfig();
  if (!writeUri) return store.setSetting(key, value);
  const c = await client("write", writeUri);
  await c.db(dbName).collection("settings").updateOne({ _id: key }, { $set: { key, value } }, { upsert: true });
  return value;
}

function assertWritable(collection) {
  if (!WRITABLE.has(collection)) throw new Error(`The agent may not write ${collection}.`);
}

export async function writeInsert(collection, doc) {
  assertWritable(collection);
  const { writeUri } = agentConfig();
  if (!writeUri) return store.insert(collection, doc);
  const c = await client("write", writeUri);
  await c.db(dbName).collection(collection).insertOne({ ...doc, _id: doc.id });
  return doc;
}

export async function writeUpdate(collection, id, patch) {
  assertWritable(collection);
  const { writeUri } = agentConfig();
  const { id: _i, _id: _m, ...fields } = patch;
  if (!writeUri) return store.updateOne(collection, id, fields);
  const c = await client("write", writeUri);
  const res = await c.db(dbName).collection(collection).findOneAndUpdate({ _id: id }, { $set: fields }, { returnDocument: "after" });
  return strip(res);
}

// ---------------------------------------------------------------------------
// Bookkeeping (app store)
// ---------------------------------------------------------------------------
const now = () => new Date().toISOString();

export async function alreadyProcessed(emailId) {
  return Boolean(await store.findOne("agent_processed", (r) => r.emailId === emailId));
}

export async function markProcessed(emailId, note = "") {
  return store.insert("agent_processed", { id: store.newId("proc"), emailId, note, at: now() });
}

export async function getThread(rootId) {
  return store.findOne("agent_threads", (t) => t.rootId === rootId);
}

export async function saveThread(thread) {
  const existing = await getThread(thread.rootId);
  if (existing) return store.updateOne("agent_threads", existing.id, { ...thread, updatedAt: now() });
  return store.insert("agent_threads", { id: store.newId("thr"), createdAt: now(), updatedAt: now(), ...thread });
}

export async function listThreads(predicate) {
  return store.findAll("agent_threads", predicate);
}

export async function createEscalation(doc) {
  return store.insert("agent_escalations", { id: store.newId("esc"), status: "open", createdAt: now(), reminderSentAt: null, ...doc });
}

export async function findEscalation(predicate) {
  return store.findOne("agent_escalations", predicate);
}

export async function listEscalations(predicate) {
  return store.findAll("agent_escalations", predicate);
}

export async function updateEscalation(id, patch) {
  return store.updateOne("agent_escalations", id, patch);
}

export const newId = store.newId;
