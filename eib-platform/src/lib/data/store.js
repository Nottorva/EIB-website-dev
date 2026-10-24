// Data store selector.
//
//   MONGODB_URI set  -> MongoDB Atlas (store.mongo.js)
//   otherwise        -> local JSON file (store.file.js), sandbox only
//
// Every collection module imports from here and never from a concrete store,
// so the choice is made in exactly one place. A deployment without a
// database is refused rather than silently writing to an ephemeral disk.

import * as fileStore from "./store.file";
import * as mongoStore from "./store.mongo";

export const storeMode = process.env.MONGODB_URI ? "mongo" : "file";

if (storeMode === "file" && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
  console.warn("[eib] MONGODB_URI is not set; using the local file store. This will not persist on Vercel. Set MONGODB_URI.");
}

const impl = storeMode === "mongo" ? mongoStore : fileStore;

export function newId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

export const findAll = (...args) => impl.findAll(...args);
export const findOne = (...args) => impl.findOne(...args);
export const findById = (...args) => impl.findById(...args);
// Indexed lookup by one field (email) instead of scanning the collection.
// `predicate` is the slow fallback for rows stored in another case.
export const findOneBy = (...args) => impl.findOneBy(...args);
// Atomic "update if a row with field=value exists, else insert" (one row per
// email even when two saves arrive at once).
export const upsertBy = (...args) => impl.upsertBy(...args);
export const insert = (...args) => impl.insert(...args);
export const updateOne = (...args) => impl.updateOne(...args);
export const replaceOne = (...args) => impl.replaceOne(...args);
export const removeOne = (...args) => impl.removeOne(...args);
export const getSetting = (...args) => impl.getSetting(...args);
export const setSetting = (...args) => impl.setSetting(...args);
