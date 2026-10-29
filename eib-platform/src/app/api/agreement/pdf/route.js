// The agreement PDF itself. GET streams it to anyone signed in (students
// read it on the onboarding page; ?download=1 saves it). POST (multipart,
// field "file") replaces it and starts a new version; DELETE removes it.
import { guarded, HttpError } from "@/lib/auth";
import { getStudentAgreement, getStudentAgreementPdf, saveStudentAgreementPdf, deleteStudentAgreementPdf, MAX_PDF_BYTES } from "@/lib/data/agreement";

export const GET = guarded(null, async ({ req }) => {
  const [meta, pdf] = await Promise.all([getStudentAgreement(), getStudentAgreementPdf()]);
  if (!pdf) throw new HttpError(404, "No agreement has been uploaded yet.");
  const download = new URL(req.url).searchParams.get("download") === "1";
  const name = (meta.pdf?.name || "student-agreement.pdf").replace(/[^\w.\- ]+/g, "_");
  return new Response(Buffer.from(pdf.data, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") throw new HttpError(400, "Attach the PDF as the \"file\" field.");
  if (file.type && file.type !== "application/pdf") throw new HttpError(400, "Only PDF files are accepted.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, "That file is empty.");
  if (bytes.length > MAX_PDF_BYTES) throw new HttpError(413, `The PDF must be under ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB.`);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(400, "That file does not look like a PDF.");
  const meta = await saveStudentAgreementPdf({ name: file.name, type: "application/pdf", size: bytes.length, data: bytes.toString("base64") });
  return Response.json(meta, { status: 201 });
});

export const DELETE = guarded(["superAdmin"], async () => Response.json(await deleteStudentAgreementPdf()));
