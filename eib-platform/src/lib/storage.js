// File storage for deliverable uploads, example files and application
// attachments.
//
//   R2_* set   -> Cloudflare R2 via presigned URLs (browser uploads straight
//                 to the bucket; the app server never proxies file bytes)
//   otherwise  -> local disk under data/uploads (sandbox only)
//
// Keys are namespaced so permissions can be decided from the key alone:
//   deliverables/<studentId>/<uuid>/<file>
//   examples/<uuid>/<file>
//   applications/<email-slug>/<uuid>/<file>

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const r2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
};
export const storageMode = r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket ? "r2" : "local";

const LOCAL_ROOT = path.join(process.cwd(), "data", "uploads");

let client = null;
function s3() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    });
  }
  return client;
}

export function safeFileName(name) {
  const base = path.basename(String(name || "file")).replace(/[^A-Za-z0-9._-]+/g, "_");
  return base.slice(0, 120) || "file";
}

export function emailSlug(email) {
  return String(email || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function makeKey(prefix, fileName) {
  return `${prefix}/${randomUUID()}/${safeFileName(fileName)}`;
}

// A key is valid if it is under one of the known prefixes and has no traversal.
export function isValidKey(key) {
  if (typeof key !== "string" || key.includes("..") || key.startsWith("/")) return false;
  return /^(deliverables|examples|applications)\/[A-Za-z0-9._-]+\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(key) || /^examples\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(key);
}

// Where the browser should PUT the file.
export async function createUploadTarget(key, mimeType) {
  if (storageMode === "r2") {
    const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: mimeType || "application/octet-stream" }), { expiresIn: 600 });
    return { url, method: "PUT", headers: { "Content-Type": mimeType || "application/octet-stream" } };
  }
  return { url: `/api/uploads/local?key=${encodeURIComponent(key)}`, method: "PUT", headers: { "Content-Type": mimeType || "application/octet-stream" } };
}

// Where the browser can fetch the file (r2: short-lived signed URL).
export async function createDownloadUrl(key, fileName) {
  if (storageMode === "r2") {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: r2.bucket, Key: key, ResponseContentDisposition: `attachment; filename="${safeFileName(fileName || path.basename(key))}"` }),
      { expiresIn: 300 }
    );
  }
  return null; // local mode streams from disk in the download route
}

/* ---------- local-mode helpers (sandbox) ---------- */
export function localPath(key) {
  return path.join(LOCAL_ROOT, key);
}

export async function localWrite(key, bytes) {
  const p = localPath(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, bytes);
}

export function localRead(key) {
  const p = localPath(key);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}
