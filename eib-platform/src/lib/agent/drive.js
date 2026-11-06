// Google Drive search over the "EIB Documents" folder, through a service account. No googleapis
// package: the service account's key signs a JWT, Google trades it for a token, and we call the REST API.

import crypto from "node:crypto";
import { agentConfig } from "./config";

const g = globalThis;

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken() {
  const { serviceAccountJson } = agentConfig();
  if (!serviceAccountJson) return null;
  const cached = g.__eibDriveToken;
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const jwt = `${header}.${claims}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${data.error_description || data.error}`);
  g.__eibDriveToken = { token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return data.access_token;
}

/** Files in the folder (one level of subfolders included) whose names contain any of the words. */
export async function searchDocuments(query) {
  const { driveFolderId } = agentConfig();
  const token = await accessToken();
  if (!token || !driveFolderId) return { configured: false, files: [] };
  const words = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9àâçéèêëîïôûùüÿñ]+/i)
    .filter((w) => w.length > 2);
  const all = await listFolder(token, driveFolderId, 1);
  const scored = all
    .map((f) => {
      const name = f.name.toLowerCase();
      const score = words.reduce((n, w) => n + (name.includes(w) ? 1 : 0), 0);
      return { ...f, score };
    })
    .filter((f) => (words.length ? f.score > 0 : true))
    .sort((a, b) => b.score - a.score || String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
  return { configured: true, files: scored.slice(0, 3).map(({ name, modifiedTime, webViewLink }) => ({ name, modifiedTime, link: webViewLink })) };
}

async function listFolder(token, folderId, depth) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive error: ${data.error?.message || res.status}`);
  const files = [];
  for (const f of data.files || []) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      if (depth > 0) files.push(...(await listFolder(token, f.id, depth - 1)));
    } else files.push(f);
  }
  return files;
}
