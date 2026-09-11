import { guarded } from "@/lib/auth";
import { listLessons, createLesson } from "@/lib/data/lessons";

// Any signed-in role may read the curriculum (CRM and Manager need it too).
export const GET = guarded(null, async () => Response.json(await listLessons()));

// Only the Lesson Editor (super admin) writes.
export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await req.json().catch(() => ({}));
  return Response.json(await createLesson(body), { status: 201 });
});
