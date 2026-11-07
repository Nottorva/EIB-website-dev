// GET /api/agent/remind: once a day (Vercel Cron, see vercel.json). Escalations open for 3 days get one
// reminder to Josef, then nothing more; change tickets nobody decided on expire. Protected by CRON_SECRET
// (Vercel sends it as a bearer token).

import { agentConfig, ESCALATION_REMINDER_DAYS, SIGNATURE } from "@/lib/agent/config";
import { listEscalations, updateEscalation } from "@/lib/agent/db";
import { sendMail } from "@/lib/agent/mail";
import { expireTickets } from "@/lib/agent/changes";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const cfg = agentConfig();
  const auth = req.headers.get("authorization") || "";
  if (cfg.cronSecret && auth !== `Bearer ${cfg.cronSecret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!cfg.cronSecret && process.env.NODE_ENV === "production") return Response.json({ error: "CRON_SECRET is not set." }, { status: 401 });

  const cutoff = Date.now() - ESCALATION_REMINDER_DAYS * 86400_000;
  const due = await listEscalations((e) => e.status === "open" && !e.reminderSentAt && Date.parse(e.createdAt) < cutoff);
  let sent = 0;
  for (const e of due) {
    await sendMail({
      to: cfg.josefAddresses.slice(0, 1),
      subject: `Reminder: ${e.josefSubject}`,
      text: `${e.askerName || e.askerEmail} is still waiting on this one (asked ${e.createdAt.slice(0, 10)}):\n\n${e.question}\n\nReply to the original [EIB Q-${e.shortId}] email and I will pass it on. This is the only reminder I will send.\n\n--\n${SIGNATURE(cfg.josefName)}`,
      inReplyTo: e.josefMessageId,
    });
    await updateEscalation(e.id, { reminderSentAt: new Date().toISOString() });
    sent += 1;
  }
  const expired = await expireTickets();
  if (expired.length) console.log(`[eib agent] changes: ${expired.length} ticket(s) expired: ${expired.map((c) => c.shortId).join(", ")}`);
  return Response.json({ ok: true, reminded: sent, expiredTickets: expired.map((c) => c.shortId) });
}
