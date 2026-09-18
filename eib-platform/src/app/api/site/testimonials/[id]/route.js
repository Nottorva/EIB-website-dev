import { guarded, readJson, HttpError } from "@/lib/auth";
import { saveTestimonial, deleteTestimonial } from "@/lib/data/testimonials";

export const PUT = guarded(["superAdmin"], async ({ req, params }) => {
  const body = await readJson(req);
  const saved = await saveTestimonial(params.id, body);
  if (!saved) throw new HttpError(404, "Testimonial not found.");
  return Response.json(saved);
});

export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const ok = await deleteTestimonial(params.id);
  if (!ok) throw new HttpError(404, "Testimonial not found.");
  return Response.json({ ok: true });
});
