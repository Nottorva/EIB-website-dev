// POST { fileName, mimeType, size, purpose }
// Returns { key, url, method, headers } - where the browser should PUT the file.
//
// purpose decides who may upload and where the file lives:
//   deliverable  -> signed-in student, key under deliverables/<their id>/
//   example      -> super admin, key under examples/
//   application  -> signed-in applicant while the window is open, key under applications/<email>/
import { open, readJson, HttpError, getCurrentUser } from "@/lib/auth";
import { getApplicant, emailOnDomain } from "@/lib/applicant";
import { getApplicationWindow, windowState } from "@/lib/data/settings";
import { createUploadTarget, makeKey, emailSlug, MAX_UPLOAD_BYTES } from "@/lib/storage";

export const POST = open(async ({ req }) => {
  const { fileName, mimeType, size, purpose } = await readJson(req);
  if (!fileName) throw new HttpError(400, "fileName is required.");
  if (Number(size) > MAX_UPLOAD_BYTES) throw new HttpError(413, `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);

  let key;
  if (purpose === "deliverable") {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Sign in to upload.");
    if (user.role !== "student") throw new HttpError(403, "Only students upload deliverables.");
    key = makeKey(`deliverables/${user.id}`, fileName);
  } else if (purpose === "example") {
    const user = await getCurrentUser();
    if (!user) throw new HttpError(401, "Sign in to upload.");
    if (user.role !== "superAdmin") throw new HttpError(403, "Only the super admin uploads example files.");
    key = makeKey("examples", fileName);
  } else if (purpose === "application") {
    const applicant = await getApplicant();
    if (!applicant) throw new HttpError(401, "Sign in with your school account to upload.");
    const win = await getApplicationWindow();
    if (windowState(win) !== "open") throw new HttpError(403, "Applications are not open.");
    if (!emailOnDomain(applicant.email, win.applicantDomain)) throw new HttpError(403, `Applications require an @${win.applicantDomain} account.`);
    key = makeKey(`applications/${emailSlug(applicant.email)}`, fileName);
  } else {
    throw new HttpError(400, "purpose must be deliverable, example or application.");
  }

  const target = await createUploadTarget(key, mimeType);
  return Response.json({ key, ...target });
});
