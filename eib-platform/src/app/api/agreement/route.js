// The Student Agreement settings. Anyone signed in reads the metadata (a
// student also gets whether they still have to sign); the super admin
// edits the title, the intro text and whether signing is required.
import { guarded, readJson } from "@/lib/auth";
import { getStudentAgreement, saveStudentAgreement, agreementPending, RELATIONSHIPS } from "@/lib/data/agreement";

export const GET = guarded(null, async ({ user }) => {
  const meta = await getStudentAgreement();
  return Response.json({
    ...meta,
    relationships: RELATIONSHIPS,
    pending: agreementPending(user, meta),
    signed: user.role === "student" && user.agreement && user.agreement.version === meta.version ? user.agreement : null,
  });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  return Response.json(await saveStudentAgreement(body));
});
