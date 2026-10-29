// A lesson's slides or teaching plan file.
//   GET    streams it (slides: anyone signed in; teaching plan: staff only);
//          ?download=1 saves instead of opening.
//   POST   multipart field "file" replaces it (super admin, 4 MB max)
//   DELETE removes it (super admin)
import { guarded, HttpError } from "@/lib/auth";
import { getLessonFile, saveLessonFile, deleteLessonFile, FILE_KINDS, MAX_FILE_BYTES } from "@/lib/data/lessonFiles";

const safeName = (n) => String(n || "file").replace(/[^\w.\- ()]+/g, "_");

export const GET = guarded(null, async ({ req, params, user }) => {
  const { id, kind } = params;
  if (!FILE_KINDS.includes(kind)) throw new HttpError(404, "Not found.");
  if (kind === "teachingPlan" && !["superAdmin", "studentLeader"].includes(user.role)) throw new HttpError(403, "The teaching plan is for staff.");
  const file = await getLessonFile(id, kind);
  if (!file) throw new HttpError(404, "No file has been uploaded for this lesson yet.");
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(Buffer.from(file.data, "base64"), {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeName(file.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export const POST = guarded(["superAdmin"], async ({ req, params }) => {
  const { id, kind } = params;
  if (!FILE_KINDS.includes(kind)) throw new HttpError(404, "Not found.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new HttpError(400, "Attach the file as the \"file\" field.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, "That file is empty.");
  if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, `Files must be under ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB. Export a PDF, or compress it, and try again.`);
  const saved = await saveLessonFile(id, kind, { name: file.name, type: file.type, size: bytes.length, data: bytes.toString("base64") });
  if (!saved) throw new HttpError(404, "Lesson not found.");
  return Response.json(saved, { status: 201 });
});

export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const { id, kind } = params;
  if (!FILE_KINDS.includes(kind)) throw new HttpError(404, "Not found.");
  const saved = await deleteLessonFile(id, kind);
  if (!saved) throw new HttpError(404, "Lesson not found.");
  return Response.json(saved);
});
