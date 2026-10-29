// Public-site content the super admin edits: the ticker strip and the
// on the server, so nothing here needs to be public.
import { guarded, readJson } from "@/lib/auth";
import { getSiteTicker, saveSiteTicker, DEFAULT_TICKER } from "@/lib/data/settings";

export const GET = guarded(["superAdmin"], async () => {
  const ticker = await getSiteTicker();
  return Response.json({ ticker, defaultTicker: DEFAULT_TICKER });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const ticker = await saveSiteTicker(body.ticker);
  return Response.json({ ticker });
});
