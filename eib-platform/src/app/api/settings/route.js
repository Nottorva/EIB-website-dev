// Program settings. Leaders and super admin read; only super admin writes.
//   classSizeCap  seats in the class
//   waitlistSpots how many can wait once it is full
//   classStarted  false while sign-ups only hold a seat; true once lessons are open
import { guarded, readJson, HttpError } from "@/lib/auth";
import { getClassSizeCap, setClassSizeCap, getWaitlistSpots, setWaitlistSpots, getClassStarted, setClassStarted, getCohortYear } from "@/lib/data/settings";
import { promoteFromWaitlist } from "@/lib/data/applications";

const all = async () => {
  const [classSizeCap, waitlistSpots, classStarted, cohortYear] = await Promise.all([getClassSizeCap(), getWaitlistSpots(), getClassStarted(), getCohortYear()]);
  return { classSizeCap, waitlistSpots, classStarted, cohortYear };
};

export const GET = guarded(["superAdmin", "studentLeader", "advancement"], async () => Response.json(await all()));

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (body.classSizeCap === undefined && body.waitlistSpots === undefined && body.classStarted === undefined) throw new HttpError(400, "Nothing to change: send classSizeCap, waitlistSpots or classStarted.");
  if (body.classSizeCap !== undefined) await setClassSizeCap(body.classSizeCap);
  if (body.waitlistSpots !== undefined) await setWaitlistSpots(body.waitlistSpots);
  if (body.classStarted !== undefined) await setClassStarted(body.classStarted);
  // a bigger class has free seats: the first people waiting move in
  const promoted = body.classSizeCap !== undefined ? await promoteFromWaitlist({ origin: new URL(req.url).origin }) : [];
  return Response.json({ ...(await all()), promoted });
});
