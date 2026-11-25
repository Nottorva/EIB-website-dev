// Student Manager > Reminders. Super admin only.
//
// GET                       the switch, who has unfinished work that is past due, the email, recent sends
// PATCH { enabled }         automatic reminders on or off
// POST  { action: "send" }  email everyone on the list now
import { guarded, readJson, HttpError } from "@/lib/auth";
import { getReminderSettings, saveReminderSettings, reminderPlan, reminderEmail, sendReminders, recentReminders } from "@/lib/data/reminders";
import { getClassStarted } from "@/lib/data/settings";
import { emailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const siteOf = (req) => (process.env.NODE_ENV === "production" ? "https://www.joineib.ca" : new URL(req.url).origin);

// Shown on the tab when nobody has anything outstanding, so the wording can still be read.
const EXAMPLE = { student: { name: "Amara Chen" }, items: [{ lessonId: "example", chapter: "Chapter 1", short: "1B", title: "Problem Validation Worksheet", due: "2026-11-19", of: 2 }] };

async function overview(req) {
  const [settings, plan, fresh, classStarted, recent] = await Promise.all([getReminderSettings(), reminderPlan(), reminderPlan({ onlyNew: true }), getClassStarted(), recentReminders()]);
  const shown = plan[0] || EXAMPLE;
  return {
    enabled: settings.enabled,
    classStarted,
    emailReady: emailConfigured(),
    students: plan.map((p) => ({ id: p.student.id, name: p.student.name, email: p.student.email, items: p.items.map(({ chapter, short, title, due }) => ({ chapter, short, title, due })) })),
    // who the next automatic run would email (people with a chapter they have not been told about yet)
    nextAutomatic: fresh.length,
    sample: { ...reminderEmail(shown.student, shown.items, siteOf(req)), example: !plan.length },
    recent,
  };
}

export const GET = guarded(["superAdmin"], async ({ req }) => Response.json(await overview(req)));

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (body.enabled === undefined) throw new HttpError(400, "Nothing to change: send enabled.");
  await saveReminderSettings({ enabled: body.enabled });
  return Response.json(await overview(req));
});

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (body.action !== "send") throw new HttpError(400, "Send action send.");
  const result = await sendReminders({ manual: true, origin: siteOf(req) });
  return Response.json({ ...(await overview(req)), result });
});
