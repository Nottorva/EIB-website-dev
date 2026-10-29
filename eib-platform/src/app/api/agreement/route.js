// The Student Agreement settings. Anyone signed in reads the metadata (a
// student also gets whether they still have to sign); the super admin
// edits the title, the intro text and whether signing is required.
import { guarded, readJson } from "@/lib/auth";
import { getStudentAgreement, saveStudentAgreement, agreementPending, publicRecord, isSigned, isPending, RELATIONSHIPS } from "@/lib/data/agreement";
import { emailConfigured } from "@/lib/mailer";

export const GET = guarded(null, async ({ user }) => {
  const meta = await getStudentAgreement();
  return Response.json({
    ...meta,
    relationships: RELATIONSHIPS,
    pending: agreementPending(user, meta),
    // the student's own record for this version: status "signed" or "pending"
    record: user.role === "student" && (isSigned(user.agreement, meta) || isPending(user.agreement, meta)) ? publicRecord(user.agreement) : null,
    emailMode: emailConfigured() ? "live" : "outbox",
  });
});

export const PUT = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  return Response.json(await saveStudentAgreement(body));
});
