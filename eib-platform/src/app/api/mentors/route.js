import { guarded } from "@/lib/auth";
import { listMentors, createMentor } from "@/lib/data/mentors";
import { getCohortYear } from "@/lib/data/settings";

const CRM_ROLES = ["superAdmin", "studentLeader"];

export const GET = guarded(CRM_ROLES, async () => {
  const [mentors, cohortYear] = await Promise.all([listMentors(), getCohortYear()]);
  return Response.json({ mentors, cohortYear });
});

export const POST = guarded(CRM_ROLES, async ({ req }) => {
  const body = await req.json().catch(() => ({}));
  return Response.json(await createMentor(body), { status: 201 });
});
