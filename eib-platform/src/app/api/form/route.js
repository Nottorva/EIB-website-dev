// The application form definition. Public read (applicants need it),
// leader/super-admin write (Forms tab).
import { guarded, open, readJson } from "@/lib/auth";
import { getApplicationForm, saveApplicationForm } from "@/lib/data/settings";

export const GET = open(async () => Response.json(await getApplicationForm()));

export const PUT = guarded(["superAdmin", "studentLeader"], async ({ req }) => {
  const body = await readJson(req);
  return Response.json(await saveApplicationForm(body));
});
