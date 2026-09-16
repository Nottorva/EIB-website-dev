// SANDBOX ONLY: receives the browser's PUT when no R2 bucket is configured
// and writes the file under data/uploads. In R2 mode the browser PUTs to a
// presigned bucket URL instead and this route refuses.
import { open, HttpError } from "@/lib/auth";
import { isValidKey, storageMode, localWrite, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const PUT = open(async ({ req }) => {
  if (storageMode !== "local") throw new HttpError(404, "Not available when R2 is configured.");
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!isValidKey(key)) throw new HttpError(400, "Invalid file key.");
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "File too large.");
  await localWrite(key, bytes);
  return Response.json({ ok: true, key, size: bytes.length });
});
