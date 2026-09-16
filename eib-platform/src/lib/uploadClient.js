"use client";

import { api } from "./api";

// Uploads a File and returns the payload shape stored on submissions,
// examples and application answers: { fileName, size, mimeType, key }.
// purpose: "deliverable" | "example" | "application"
export async function uploadFile(file, purpose) {
  const target = await api.post("/api/uploads", { fileName: file.name, mimeType: file.type, size: file.size, purpose });
  const res = await fetch(target.url, { method: target.method, headers: target.headers, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
  return { fileName: file.name, size: file.size, mimeType: file.type, key: target.key };
}

export function downloadUrl(payload) {
  if (!payload?.key) return null;
  return `/api/uploads/download?key=${encodeURIComponent(payload.key)}`;
}
