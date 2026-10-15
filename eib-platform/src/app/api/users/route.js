// Super admin only. Lists users; creates student leader and advancement
// team accounts (students are created by releasing decisions).
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listUsers, createStaff } from "@/lib/data/users";

export const GET = guarded(["superAdmin"], async ({ req }) => {
  const role = new URL(req.url).searchParams.get("role") || undefined;
  return Response.json(await listUsers({ role }));
});

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (!body.email?.trim()) throw new HttpError(400, "email is required.");
  const role = body.role === "advancement" ? "advancement" : "studentLeader";
  if (role === "studentLeader" && !body.name?.trim()) throw new HttpError(400, "name and email are required.");
  return Response.json(await createStaff({ name: body.name, email: body.email, role }), { status: 201 });
});
