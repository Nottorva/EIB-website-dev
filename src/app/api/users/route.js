// Acc Manager: super admin only. Lists / creates student leaders.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listUsers, createLeader } from "@/lib/data/users";

export const GET = guarded(["superAdmin"], async ({ req }) => {
  const role = new URL(req.url).searchParams.get("role") || undefined;
  return Response.json(await listUsers({ role }));
});

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (!body.name?.trim() || !body.email?.trim()) throw new HttpError(400, "name and email are required.");
  return Response.json(await createLeader(body), { status: 201 });
});
