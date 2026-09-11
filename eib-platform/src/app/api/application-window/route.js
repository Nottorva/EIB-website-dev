// The application link's open/close window. Leaders and super admin read and
// write it here; the public /apply page reads the derived state via
// /api/apply/status.
import { guarded, readJson } from "@/lib/auth";
import { getApplicationWindow, saveApplicationWindow, windowState } from "@/lib/data/settings";

const ROLES = ["superAdmin", "studentLeader"];

async function payload() {
  const win = await getApplicationWindow();
  return { ...win, state: windowState(win), now: new Date().toISOString() };
}

export const GET = guarded(ROLES, async () => Response.json(await payload()));

export const PUT = guarded(ROLES, async ({ req }) => {
  const body = await readJson(req);
  await saveApplicationWindow(body);
  return Response.json(await payload());
});
