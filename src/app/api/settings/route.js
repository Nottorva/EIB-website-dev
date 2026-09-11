// Program settings. Leaders and super admin read; only super admin writes.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { getClassSizeCap, setClassSizeCap, getCohortYear } from "@/lib/data/settings";

export const GET = guarded(["superAdmin", "studentLeader"], async () => {
  const [classSizeCap, cohortYear] = await Promise.all([getClassSizeCap(), getCohortYear()]);
  return Response.json({ classSizeCap, cohortYear });
});

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (body.classSizeCap === undefined) throw new HttpError(400, "classSizeCap is required.");
  const classSizeCap = await setClassSizeCap(body.classSizeCap);
  return Response.json({ classSizeCap, cohortYear: await getCohortYear() });
});
