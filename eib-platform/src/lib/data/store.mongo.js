// MongoDB Atlas data store (used when MONGODB_URI is set).
//
// Same function signatures as store.file.js. Documents are stored with
// `_id` equal to the app-level `id` so lookups are indexed; `_id` is stripped
// on the way out so the rest of the app only ever sees `id`.
//
// The collections are tiny (one school program), so predicate-based reads
// fetch the collection and filter in memory. Revisit if a collection ever
// grows past a few thousand documents.

import { MongoClient } from "mongodb";
import { minimalSeed, sampleSeed } from "./seed";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "eib";

// Cache the client across hot reloads / serverless invocations.
const globalRef = globalThis;
function getClientPromise() {
  if (!globalRef.__eibMongoClientPromise) {
    if (!uri) throw new Error("MONGODB_URI is not set.");
    globalRef.__eibMongoClientPromise = new MongoClient(uri).connect();
  }
  return globalRef.__eibMongoClientPromise;
}

async function db() {
  const client = await getClientPromise();
  const database = client.db(dbName);
  await ensureSeeded(database);
  return database;
}

// First run on an empty database: create the super admin from the
// environment plus default settings. SEED_SAMPLE_DATA=true loads the full
// sandbox sample instead (useful for a staging deployment, never for prod).
async function ensureSeeded(database) {
  if (globalRef.__eibMongoSeeded) return;
  const usersCount = await database.collection("users").estimatedDocumentCount();
  const settingsCount = await database.collection("settings").estimatedDocumentCount();
  if (usersCount === 0 && settingsCount === 0) {
    const seed =
      process.env.SEED_SAMPLE_DATA === "true"
        ? sampleSeed()
        : minimalSeed({ adminEmail: process.env.SUPER_ADMIN_EMAIL, adminName: process.env.SUPER_ADMIN_NAME });
    for (const [name, rows] of Object.entries(seed)) {
      if (name === "settings") {
        const docs = Object.entries(rows).map(([key, value]) => ({ _id: key, key, value }));
        if (docs.length) await database.collection("settings").insertMany(docs);
      } else if (rows.length) {
        await database.collection(name).insertMany(rows.map((r) => ({ ...r, _id: r.id })));
      }
    }
    await database.collection("users").createIndex({ email: 1 }, { unique: true });
    await database.collection("submissions").createIndex({ studentId: 1, lessonId: 1, deliverableId: 1 }, { unique: true });
    await database.collection("applications").createIndex({ email: 1 });
    console.log(`[eib] Seeded empty MongoDB database "${dbName}" (${process.env.SEED_SAMPLE_DATA === "true" ? "sample" : "minimal"}).`);
  }
  globalRef.__eibMongoSeeded = true;
}

const strip = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
};

export async function findAll(collection, predicate) {
  const rows = (await (await db()).collection(collection).find({}).toArray()).map(strip);
  return predicate ? rows.filter(predicate) : rows;
}

export async function findOne(collection, predicate) {
  const rows = await findAll(collection, predicate);
  return rows[0] || null;
}

export async function findById(collection, id) {
  return strip(await (await db()).collection(collection).findOne({ _id: id }));
}

export async function insert(collection, doc) {
  await (await db()).collection(collection).insertOne({ ...doc, _id: doc.id });
  return doc;
}

export async function updateOne(collection, id, patch) {
  const { id: _ignored, _id, ...fields } = patch;
  const res = await (await db()).collection(collection).findOneAndUpdate({ _id: id }, { $set: fields }, { returnDocument: "after" });
  return strip(res);
}

export async function replaceOne(collection, id, doc) {
  const res = await (await db()).collection(collection).findOneAndReplace({ _id: id }, { ...doc, id, _id: id }, { returnDocument: "after" });
  return strip(res);
}

export async function removeOne(collection, id) {
  const res = await (await db()).collection(collection).deleteOne({ _id: id });
  return res.deletedCount > 0;
}

export async function getSetting(key) {
  const doc = await (await db()).collection("settings").findOne({ _id: key });
  return doc ? doc.value : undefined;
}

export async function setSetting(key, value) {
  await (await db()).collection("settings").updateOne({ _id: key }, { $set: { key, value } }, { upsert: true });
  return value;
}
