// /api/agent/changes (super admin): the change tickets the /changes page shows and decides.
//   GET                          every ticket, newest first
//   PUT  { id, decision: "approve" | "reject", reason? }
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listChanges, getChange, applyTicket, rejectTicket, notifyDecision } from "@/lib/agent/changes";
import { CHANGE_EXPIRY_DAYS } from "@/lib/agent/config";

const strip = (c) => ({ ...c, steps: (c.steps || []).map(({ draft, ...s }) => s) });

async function all() {
  const changes = await listChanges(() => true);
  return { changes: changes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(strip), expiryDays: CHANGE_EXPIRY_DAYS };
}

export const GET = guarded(["superAdmin"], async () => Response.json(await all()));

export const PUT = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  const ticket = body.id ? await getChange(body.id) : null;
  if (!ticket) throw new HttpError(404, "No such change ticket.");
  if (ticket.status !== "proposed") throw new HttpError(409, `This ticket is already ${ticket.status}.`);
  let updated;
  try {
    updated = body.decision === "approve" ? await applyTicket(ticket, { by: user.email }) : body.decision === "reject" ? await rejectTicket(ticket, { by: user.email, reason: body.reason || "" }) : null;
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  if (!updated) throw new HttpError(400, 'decision must be "approve" or "reject".');
  try {
    await notifyDecision(updated, { viaEmail: false });
  } catch (e) {
    console.error(`[eib agent] could not send the decision emails: ${e.message}`);
  }
  return Response.json({ message: updated.status === "rejected" ? "Rejected. Nothing was changed." : updated.status === "applied" ? "Applied." : updated.status === "partly applied" ? "Partly applied; see the steps." : "Could not apply; see the steps.", ...(await all()) });
});
