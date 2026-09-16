// GET ?key=...  Streams (local) or redirects to a signed URL (R2).
// Who may read what is decided from the key prefix:
//   deliverables/<id>/... -> that student, or any leader / super admin
//   examples/...          -> anyone signed in (students see examples)
//   applications/<slug>/  -> that applicant, or any leader / super admin
import path from "node:path";
import { open, HttpError, getCurrentUser } from "@/lib/auth";
import { getApplicant } from "@/lib/applicant";
import { isValidKey, storageMode, createDownloadUrl, localRead, emailSlug } from "@/lib/storage";

const STAFF = ["superAdmin", "studentLeader"];

export const GET = open(async ({ req }) => {
  const key = new URL(req.url).searchParams.get("key") || "";
  if (!isValidKey(key)) throw new HttpError(400, "Invalid file key.");

  const [prefix, owner] = key.split("/");
  const user = await getCurrentUser();

  let allowed = false;
  if (prefix === "examples") allowed = Boolean(user);
  else if (prefix === "deliverables") allowed = Boolean(user) && (STAFF.includes(user.role) || user.id === owner);
  else if (prefix === "applications") {
    if (user && STAFF.includes(user.role)) allowed = true;
    else {
      const applicant = await getApplicant();
      allowed = Boolean(applicant) && emailSlug(applicant.email) === owner;
    }
  }
  if (!allowed) throw new HttpError(user || prefix === "applications" ? 403 : 401, "You do not have access to this file.");

  const fileName = path.basename(key);
  if (storageMode === "r2") {
    return Response.redirect(await createDownloadUrl(key, fileName), 302);
  }
  const bytes = localRead(key);
  if (!bytes) throw new HttpError(404, "File not found.");
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(bytes.length),
    },
  });
});
