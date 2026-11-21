// The public side of a one-time AIDA Unlocked demo link. No sign-in: the link is the invitation, and the
// cookie set by "start" is what proves this is the browser that claimed it. See lib/aida/demo.js.
//
// POST { start: true }   claim the link for this browser (once)
// POST { messages }      a reply, streamed; nothing typed is saved
import { cookies } from "next/headers";
import { open, readJson, HttpError } from "@/lib/auth";
import { recordUsage } from "@/lib/aida/store";
import { runUnlocked, streamResponse } from "@/lib/aida/client";
import { getKnowledge, unlockedSystem, UNLOCKED_MAX_CHARS, SEARCHING_MARK } from "@/lib/aida/unlocked";
import { getDemoLink, demoState, claimDemoLink, countDemoMessage, addDemoCost, demoCookie, DEMO_HOURS } from "@/lib/aida/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GONE = "This demo link has already been used.";

export const POST = open(async ({ req, params }) => {
  const body = await readJson(req);
  const jar = await cookies();
  const id = params.token;

  if (body.start) {
    const secret = await claimDemoLink(id);
    if (!secret) throw new HttpError(410, GONE);
    jar.set(demoCookie(id), secret, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DEMO_HOURS * 3600 });
    return Response.json(demoState(await getDemoLink(id), secret));
  }

  const link = await getDemoLink(id);
  const state = demoState(link, jar.get(demoCookie(id))?.value);
  if (state.status === "ended") throw new HttpError(403, state.why === "time" ? "This demo has ended." : "This demo has used all of its messages.");
  if (state.status !== "active") throw new HttpError(410, state.status === "spent" ? GONE : "This demo link is no longer available.");

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => ({ role: m.role, text: String(m.content || "").replaceAll(SEARCHING_MARK, "").trim().slice(0, m.role === "user" ? UNLOCKED_MAX_CHARS : 60000) }))
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.text);
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Type a message first.");

  await countDemoMessage(link);
  const system = unlockedSystem((await getKnowledge()).text);
  return streamResponse(async (send) => {
    const reply = await runUnlocked({ system, messages, onText: send });
    await Promise.all([recordUsage("demo", reply.usage), addDemoCost(link.id, reply.usage)]);
  });
});
