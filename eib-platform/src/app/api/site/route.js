// Public-site content the super admin edits: the ticker strip and the
// testimonials list. The site page itself reads the data modules directly
// on the server, so nothing here needs to be public.
import { guarded, readJson } from "@/lib/auth";
import { getSiteTicker, saveSiteTicker, DEFAULT_TICKER } from "@/lib/data/settings";
import { listTestimonials } from "@/lib/data/testimonials";

export const GET = guarded(["superAdmin"], async () => {
  const [ticker, testimonials] = await Promise.all([getSiteTicker(), listTestimonials()]);
  return Response.json({ ticker, defaultTicker: DEFAULT_TICKER, testimonials });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const ticker = await saveSiteTicker(body.ticker);
  return Response.json({ ticker });
});
