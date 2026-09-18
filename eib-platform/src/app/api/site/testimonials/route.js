import { guarded, readJson, HttpError } from "@/lib/auth";
import { createTestimonial } from "@/lib/data/testimonials";

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (!String(body.quote || "").trim()) throw new HttpError(400, "A testimonial needs a quote.");
  return Response.json(await createTestimonial(body), { status: 201 });
});
