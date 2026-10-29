// LOCAL DEVELOPMENT ONLY: makes a student's current confirmation link
// expired so the expired path can be tested. Disabled in production.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { expireConfirmationForTest } from "@/lib/data/agreement";
import { authEnabled } from "@/lib/nextauth";

export const POST = guarded(["superAdmin"], async ({ req }) => {
  if (authEnabled || process.env.NODE_ENV === "production") throw new HttpError(404, "Not found.");
  const { userId } = await readJson(req);
  const rec = await expireConfirmationForTest(userId);
  if (!rec) throw new HttpError(404, "No pending agreement for that user.");
  return Response.json(rec);
});
