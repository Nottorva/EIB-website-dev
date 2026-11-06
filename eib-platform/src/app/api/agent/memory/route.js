// /api/agent/memory (super admin): the assistant's memory as the /crm Memory tab edits it.
//   GET                      every topic with its history, plus which are archived
//   POST   { topic, status, summary }
//   PATCH  { id, topic?, status?, summary? }
//   DELETE ?id=
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listMemory, isArchived, upsertMemory, patchMemory, deleteMemory, MEMORY_STATUSES, ARCHIVE_AFTER_DAYS } from "@/lib/agent/memory";

async function all() {
  const items = await listMemory();
  return { items: items.map((m) => ({ ...m, archived: isArchived(m) })), statuses: MEMORY_STATUSES, archiveAfterDays: ARCHIVE_AFTER_DAYS };
}

export const GET = guarded(["superAdmin"], async () => Response.json(await all()));

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (!String(body.topic || "").trim()) throw new HttpError(400, "Topic is required.");
  await upsertMemory({ topic: body.topic, status: body.status, summary: body.summary || "", source: "web" });
  return Response.json(await all());
});

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (!body.id) throw new HttpError(400, "id is required.");
  const updated = await patchMemory(body.id, body);
  if (!updated) throw new HttpError(404, "No such topic.");
  return Response.json(await all());
});

export const DELETE = guarded(["superAdmin"], async ({ req }) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id is required.");
  await deleteMemory(id);
  return Response.json(await all());
});
