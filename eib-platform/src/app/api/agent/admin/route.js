// /api/agent/admin (super admin only): what the /agent page shows and edits.
//   GET            config status, access list, open escalations, FAQ, recent threads
//   PUT            { grant: "email or domain", name? } | { revoke: "email or domain" }
//   DELETE ?faq=id removes an FAQ entry
import { guarded, readJson, HttpError } from "@/lib/auth";
import { agentConfig } from "@/lib/agent/config";
import { effectiveAccess, grantAccess, revokeAccess } from "@/lib/agent/access";
import { listEscalations, listFaq, listThreads } from "@/lib/agent/db";
import { removeOne } from "@/lib/data/store";

async function snapshot() {
  const cfg = agentConfig();
  const [access, escalations, faq, threads] = await Promise.all([effectiveAccess(), listEscalations(() => true), listFaq(), listThreads(() => true)]);
  return {
    config: {
      address: cfg.address || null,
      josefAddresses: cfg.josefAddresses,
      model: cfg.model,
      resend: Boolean(cfg.resendKey),
      webhookSecret: Boolean(cfg.webhookSecret),
      anthropic: Boolean(cfg.anthropicKey),
      drive: Boolean(cfg.serviceAccountJson && cfg.driveFolderId),
      readUser: Boolean(cfg.readUri),
      writeUser: Boolean(cfg.writeUri),
      cron: Boolean(cfg.cronSecret),
    },
    access,
    escalations: escalations.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50),
    faq: faq.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    threads: threads
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 40)
      .map((t) => ({ id: t.id, subject: t.subject, lastFrom: t.lastFrom, senderKind: t.senderKind, mode: t.mode, lastOutcome: t.lastOutcome, updatedAt: t.updatedAt, messages: (t.messages || []).length, sent: (t.sent || []).length, draft: t.draft ? `${t.draft.kind} ${t.draft.action}: ${t.draft.targetName}` : null })),
  };
}

export const GET = guarded(["superAdmin"], async () => Response.json(await snapshot()));

export const PUT = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  let result;
  try {
    if (body.grant) result = await grantAccess(body.grant, { name: body.name || "", addedBy: user.email });
    else if (body.revoke) result = await revokeAccess(body.revoke);
    else throw new HttpError(400, "Send { grant } or { revoke }.");
  } catch (e) {
    throw new HttpError(e.status || 400, e.message);
  }
  return Response.json({ ...result, ...(await snapshot()) });
});

export const DELETE = guarded(["superAdmin"], async ({ req }) => {
  const id = new URL(req.url).searchParams.get("faq");
  if (!id) throw new HttpError(400, "faq id required.");
  await removeOne("agent_faq", id);
  return Response.json(await snapshot());
});
