// Change tickets: a request ("Cougar's Den moves to Nov 24", "Ray is confirmed for L4", "add a mentor ...")
// becomes a numbered plan of exact edits, platform records and document spots, that waits for Josef's
// approval on /changes (or a YES by email). On approval every step is applied and both Josef and the
// requester hear what was changed. Nothing is written before approval.

import { agentConfig, CHANGE_EXPIRY_DAYS } from "./config";
import { createChange, getChange, listChanges, updateChange } from "./db";
import { buildDraft, commitDraft, previewDraft } from "./edits";
import { checkDocumentEdit, applyDocumentEdit } from "./drive";
import { sendMail } from "./mail";
import { composeForJosef, CHANGES_URL } from "./style";

const now = () => new Date().toISOString();
const shortId = () => Math.random().toString(36).slice(2, 7);
const kindOfRecord = { mentor: "mentor", lesson: "lesson", event: "event", applications: "applications" };

/**
 * Check every proposed step against the live data and store the ticket.
 * Returns { ticket, usable } where usable is the number of steps that can actually be applied.
 */
export async function createTicket({ plan, requester, threadRootId, status = "proposed" }) {
  const steps = [];
  let n = 0;
  for (const raw of plan.steps || []) {
    n += 1;
    const step = { n, kind: raw.kind, description: String(raw.description || "").trim(), status: "ready", problem: "", before: "", after: "", result: "" };
    try {
      if (raw.kind === "platform") {
        const edit = { target_kind: kindOfRecord[raw.record] || "", target_name: String(raw.target || ""), action: raw.action || "update", fields: raw.fields || {} };
        if (!edit.target_kind) throw new Error("No record kind given.");
        const r = await buildDraft({ edit, existingDraft: null });
        if (r.status !== "ready") throw new Error(r.message);
        const preview = await previewDraft(r.draft);
        Object.assign(step, { record: raw.record, target: r.draft.targetName, action: r.draft.action, draft: r.draft, before: preview.before, after: preview.after, title: preview.title });
        if (r.draft.note) step.note = r.draft.note;
      } else if (raw.kind === "document") {
        const chk = await checkDocumentEdit(raw);
        if (!chk.ok) throw new Error(chk.problem);
        Object.assign(step, { document: chk.file.name, link: chk.file.link, edit: raw.edit, find: raw.find || "", replace: raw.replace || "", table: raw.table, row: raw.row, column: raw.column, sheet: raw.sheet || "", cell: raw.cell || "", new_text: raw.new_text || "", before: chk.before, after: chk.after, count: chk.count, title: chk.file.name, ...(chk.rowLabel !== undefined ? { rowLabel: chk.rowLabel } : {}) });
      } else throw new Error(`Unknown step kind "${raw.kind}".`);
    } catch (e) {
      step.status = "skipped";
      step.problem = e.message;
    }
    steps.push(step);
  }
  const usable = steps.filter((s) => s.status === "ready").length;
  const ticket = await createChange({
    status,
    shortId: shortId(),
    summary: String(plan.summary || "Change request").slice(0, 120),
    notes: String(plan.notes || "").trim(),
    steps,
    requester,
    threadRootId,
    expiresAt: new Date(Date.now() + CHANGE_EXPIRY_DAYS * 86400_000).toISOString(),
  });
  return { ticket, usable };
}

const stepLine = (s) => {
  const head = `${s.n}. ${s.description}`;
  if (s.status === "skipped") return `${head}\nNot possible: ${s.problem}`;
  const ba = s.before !== "" || s.after !== "" ? `\n${s.before ? `Before: ${s.before}` : "Before: (blank)"}\nAfter: ${s.after || "(blank)"}` : "";
  const extra = s.kind === "document" && s.count > 1 ? `\n(${s.count} places)` : "";
  const note = s.note ? `\nNote: ${s.note}` : "";
  return `${head}${ba}${extra}${note}`;
};

/** The plan as Josef reads it in the email and on the page. */
export function describeSteps(ticket) {
  return (ticket.steps || []).map(stepLine).join("\n\n");
}

export const ticketLabel = (ticket) => `[EIB change C-${ticket.shortId}]`;
export const ticketUrl = (ticket) => `${CHANGES_URL}#C-${ticket.shortId}`;

/** What a ticket touches, in plain words for the requester: each document once, and each platform record. */
export function affectedList(ticket) {
  const lines = [];
  const seen = new Set();
  for (const s of ticket.steps || []) {
    if (s.status !== "ready") continue;
    const label = s.kind === "document" ? s.document : `EIB platform: ${s.title || s.description}`;
    if (label && !seen.has(label)) {
      seen.add(label);
      lines.push(`- ${label}`);
    }
  }
  return lines.join("\n");
}

/** The documents a ticket touches, for the References list of its emails. */
export function ticketReferences(ticket) {
  const out = [];
  const seen = new Set();
  for (const s of ticket.steps || []) {
    if (s.kind === "document" && s.document && s.link && !seen.has(s.link)) {
      seen.add(s.link);
      out.push({ title: s.document, url: s.link });
    }
  }
  return out;
}

/** The email that asks Josef to approve. */
export function ticketEmailText(ticket) {
  const who = ticket.requester?.kind === "josef" ? "You asked" : `${ticket.requester?.name || ticket.requester?.email || "Someone"} (${ticket.requester?.email}) asked`;
  return [
    `${ticketLabel(ticket)} ${ticket.summary}`,
    "",
    `${who}: ${ticket.summary}.`,
    "",
    "Here is what I would change:",
    "",
    describeSteps(ticket),
    ticket.notes ? `\nAlso for you to check: ${ticket.notes}` : "",
    "",
    `Approve or reject it here: ${ticketUrl(ticket)}`,
    "You can also reply YES to this email to approve, or NO to reject. Nothing is changed until you do.",
    `This ticket expires in ${CHANGE_EXPIRY_DAYS} days.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Apply every ready step. Updates and returns the ticket. */
export async function applyTicket(ticketOrId, { by = "" } = {}) {
  const ticket = typeof ticketOrId === "string" ? await getChange(ticketOrId) : ticketOrId;
  if (!ticket) throw new Error("No such change ticket.");
  if (ticket.status !== "proposed") throw new Error(`This ticket is already ${ticket.status}.`);
  const steps = [];
  let failed = 0;
  for (const s of ticket.steps) {
    const step = { ...s };
    if (s.status !== "ready") {
      steps.push(step);
      continue;
    }
    try {
      if (s.kind === "platform") step.result = await commitDraft(s.draft, `change ${ticket.shortId}`);
      else step.result = await applyDocumentEdit(s);
      step.status = "done";
    } catch (e) {
      step.status = "failed";
      step.problem = e.message;
      failed += 1;
    }
    steps.push(step);
  }
  const done = steps.filter((s) => s.status === "done").length;
  const status = done && !failed ? "applied" : done ? "partly applied" : "failed";
  return updateChange(ticket.id, { steps, status, decidedAt: now(), decidedBy: by, appliedAt: now() });
}

export async function rejectTicket(ticketOrId, { by = "", reason = "" } = {}) {
  const ticket = typeof ticketOrId === "string" ? await getChange(ticketOrId) : ticketOrId;
  if (!ticket) throw new Error("No such change ticket.");
  if (ticket.status !== "proposed") throw new Error(`This ticket is already ${ticket.status}.`);
  return updateChange(ticket.id, { status: "rejected", decidedAt: now(), decidedBy: by, rejectReason: String(reason || "").trim() });
}

/** Proposed tickets nobody decided on in time. */
export async function expireTickets() {
  const due = await listChanges((c) => (c.status === "proposed" || c.status === "draft") && c.expiresAt && Date.parse(c.expiresAt) < Date.now());
  for (const c of due) await updateChange(c.id, { status: "expired" });
  return due;
}

function resultLines(ticket) {
  return (ticket.steps || [])
    .map((s) => {
      if (s.status === "done") return `${s.n}. Done: ${s.result}`;
      if (s.status === "failed") return `${s.n}. Failed: ${s.problem}`;
      return `${s.n}. Skipped: ${s.problem || s.description}`;
    })
    .join("\n");
}

/** After approve or reject: tell Josef and, when someone else asked, the requester (Josef in CC). */
export async function notifyDecision(ticket, { viaEmail = false, josefThread = null } = {}) {
  const cfg = agentConfig();
  const josef = cfg.josefAddresses[0];
  const req = ticket.requester || {};
  const requesterIsJosef = req.kind === "josef";
  const headline = ticket.status === "applied" ? "Applied" : ticket.status === "partly applied" ? "Partly applied" : ticket.status === "failed" ? "Could not apply" : "Rejected";
  const subject = `${ticketLabel(ticket)} ${headline}: ${ticket.summary}`;

  // Josef hears back only when he decided by email (a confirmation in that thread). A decision made on the
  // website needs no email: the page already shows the outcome. His own tickets decided by email are
  // answered by the email handler itself.
  if (viaEmail && !requesterIsJosef) {
    const body = ticket.status === "rejected" ? `Rejected: ${ticket.summary}. I have told ${req.name || req.email}.` : `${headline}: ${ticket.summary}.\n\n${resultLines(ticket)}\n\nI have told ${req.name || req.email}.\n\nThe ticket: ${ticketUrl(ticket)}`;
    await sendMail({ to: [josef], subject, text: composeForJosef(body, ticketReferences(ticket)), inReplyTo: josefThread?.messageId });
  }
  // The requester hears nothing: they confirmed, and that was the end of the exchange. If they ask later
  // whether it went through, handle.js answers from the ticket's status.
}

export { getChange, listChanges, updateChange };
