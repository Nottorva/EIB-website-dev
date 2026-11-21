// One-time demo links for AIDA Unlocked (super admin). See lib/aida/demo.js.
//
// GET              every link and where it stands
// POST { label }   make a link
// DELETE ?id=      remove a link; if someone is using it, their demo stops
import { guarded, readJson, HttpError } from "@/lib/auth";
import { createDemoLink, deleteDemoLink, listDemoLinks, DEMO_MAX_MESSAGES, DEMO_HOURS, DEMO_UNUSED_DAYS } from "@/lib/aida/demo";

export const dynamic = "force-dynamic";

const all = async () => ({ links: await listDemoLinks(), rules: { messages: DEMO_MAX_MESSAGES, hours: DEMO_HOURS, unusedDays: DEMO_UNUSED_DAYS } });

export const GET = guarded(["superAdmin"], async () => Response.json(await all()));

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const link = await createDemoLink(body.label);
  return Response.json({ id: link.id, ...(await all()) });
});

export const DELETE = guarded(["superAdmin"], async ({ req }) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "Which link?");
  await deleteDemoLink(id);
  return Response.json(await all());
});
