// Public, no sign-in: a parent or guardian asks to sign their child up.
// POST { parentName, parentEmail, studentName, studentEmail } checks the
// details (the student's email must be on the school domain) and emails the
// parent a link. No seat is held until that link is opened.
import { open, readJson } from "@/lib/auth";
import { requestParentSignup } from "@/lib/data/parentSignup";

export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  return Response.json(await requestParentSignup(body, { origin: new URL(req.url).origin }), { status: 201 });
});
