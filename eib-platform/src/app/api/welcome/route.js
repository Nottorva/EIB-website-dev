// A student presses the button on the welcome page: remember it, and say
// where they go next (the agreement if one is waiting, else their lessons).
import { guarded } from "@/lib/auth";
import { markWelcomed } from "@/lib/data/users";
import { needsAgreement } from "@/lib/data/agreement";

export const POST = guarded(["student"], async ({ user }) => {
  const fresh = await markWelcomed(user.id);
  return Response.json({ ok: true, next: (await needsAgreement(fresh || user)) ? "/onboarding" : "/lessons" });
});
