// POST /api/agent/inbound: Resend's email.received webhook.
//
// In order: verify the signature (401 otherwise), accept only email.received, dedupe on the email id,
// fetch the full email, then hand it to the agent after the 200 has gone back (Resend retries slow
// webhooks, and a retry must never produce a second reply).
//
// Local sandbox (no RESEND_API_KEY, not production): the webhook may be unsigned and may carry the whole
// email inline under data.inline, which scripts/agent-smoke.mjs uses.

import { after } from "next/server";
import { agentConfig, agentSandbox } from "@/lib/agent/config";
import { verifyWebhook, fetchReceivedEmail } from "@/lib/agent/mail";
import { alreadyProcessed, markProcessed } from "@/lib/agent/db";
import { handleEmail } from "@/lib/agent/handle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const cfg = agentConfig();
  const rawBody = await req.text();

  if (cfg.webhookSecret) {
    const v = verifyWebhook({ rawBody, headers: req.headers, secret: cfg.webhookSecret });
    if (!v.ok) return Response.json({ error: `Invalid webhook signature (${v.reason}).` }, { status: 401 });
  } else if (!agentSandbox()) {
    return Response.json({ error: "RESEND_WEBHOOK_SECRET is not set." }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Body is not JSON." }, { status: 400 });
  }
  if (event?.type !== "email.received") return Response.json({ ok: true, ignored: event?.type || "unknown event" });

  const emailId = String(event.data?.email_id || event.data?.id || "");
  if (!emailId) return Response.json({ ok: true, ignored: "no email id" });
  if (await alreadyProcessed(emailId)) return Response.json({ ok: true, duplicate: true });
  await markProcessed(emailId, "received");

  const work = async () => {
    const started = Date.now();
    console.log(`[eib agent] ${emailId}: start`);
    try {
      const email = await fetchReceivedEmail(emailId, event.data?.inline);
      const result = await handleEmail(email);
      console.log(`[eib agent] ${emailId}: done in ${Date.now() - started} ms ${JSON.stringify(result)}`);
      return result;
    } catch (e) {
      console.error(`[eib agent] ${emailId}: FAILED after ${Date.now() - started} ms at step "${e?.step || "unknown"}": ${e?.message || e}`);
      return { error: String(e?.message || e), step: e?.step || "unknown" };
    }
  };

  // The sandbox smoke test wants the outcome in the response; production acknowledges first.
  if (agentSandbox() && req.headers.get("x-agent-sync") === "1") return Response.json({ ok: true, result: await work() });
  after(work);
  return Response.json({ ok: true });
}
