// GET /api/reminders/cron: once a day (Vercel Cron, see vercel.json), in the morning Toronto time.
// Emails each student who has a chapter that has just gone past due with a deliverable still not done.
// Does nothing unless reminders are switched on (Student Manager > Reminders) and the class has started.
// Protected by CRON_SECRET (Vercel sends it as a bearer token).

import { getReminderSettings, sendReminders } from "@/lib/data/reminders";
import { getClassStarted } from "@/lib/data/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!secret && process.env.NODE_ENV === "production") return Response.json({ error: "CRON_SECRET is not set." }, { status: 401 });

  if (!(await getReminderSettings()).enabled) return Response.json({ ok: true, skipped: "reminders are off" });
  if (!(await getClassStarted())) return Response.json({ ok: true, skipped: "the class is on hold" });
  const origin = process.env.NODE_ENV === "production" ? "https://www.joineib.ca" : new URL(req.url).origin;
  const { sent, failed } = await sendReminders({ origin });
  if (sent.length || failed.length) console.log(`[eib reminders] sent ${sent.length}, failed ${failed.length}`);
  return Response.json({ ok: true, sent: sent.length, failed: failed.length });
}
