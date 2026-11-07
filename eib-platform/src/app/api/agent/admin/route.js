// /api/agent/admin (super admin only): what the /agent page shows and edits.
//   GET            config status, access list, documents folder, ticket counts, recent threads
//   PUT            { grant: "email or domain", name? } | { revoke: "email or domain" } | { testColleague: "email", on: bool } | { programYear: "2026-2027" }
import { guarded, readJson, HttpError } from "@/lib/auth";
import { setSetting } from "@/lib/data/store";
import { agentConfig } from "@/lib/agent/config";
import { effectiveAccess, grantAccess, revokeAccess, getTestColleagues, setTestColleague, TEST_COLLEAGUE_HOURS } from "@/lib/agent/access";
import { listThreads } from "@/lib/agent/db";
import { listChanges } from "@/lib/agent/changes";
import { driveConfigured, listFiles, lastListedAt, splitByYear, isReadme } from "@/lib/agent/drive";

async function docsInfo() {
  const cfg = agentConfig();
  const configured = driveConfigured();
  let files = [];
  if (configured) {
    try {
      files = await listFiles();
    } catch (e) {
      console.error(`[eib agent] admin: drive list failed: ${e.message}`);
    }
  }
  const { year, current, archived } = await splitByYear(files);
  return {
    configured,
    folderUrl: cfg.driveFolderId ? `https://drive.google.com/drive/folders/${cfg.driveFolderId}` : "",
    fileCount: files.length,
    listedAt: lastListedAt(),
    readme: current.filter(isReadme).map((f) => f.name),
    programYear: year,
    currentCount: current.length,
    archivedCount: archived.length,
    archived: archived.map((f) => f.name),
    editable: current.filter((f) => /document|spreadsheet/.test(f.mimeType || "")).map((f) => f.name),
  };
}

async function snapshot() {
  const cfg = agentConfig();
  const [access, changes, threads, testColleagues, docs] = await Promise.all([effectiveAccess(), listChanges(() => true), listThreads(() => true), getTestColleagues(), docsInfo()]);
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
    testColleagues,
    testColleagueHours: TEST_COLLEAGUE_HOURS,
    docs,
    changes: { total: changes.length, proposed: changes.filter((c) => c.status === "proposed").length },
    threads: threads
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 40)
      .map((t) => ({ id: t.id, subject: t.subject, lastFrom: t.lastFrom, senderKind: t.senderKind, mode: t.mode, lastOutcome: t.lastOutcome, updatedAt: t.updatedAt, messages: (t.messages || []).length, sent: (t.sent || []).length, draft: t.draft ? `${t.draft.kind}${t.draft.targetName ? `: ${t.draft.targetName}` : ""}` : null })),
  };
}

export const GET = guarded(["superAdmin"], async () => Response.json(await snapshot()));

export const PUT = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req);
  let result;
  try {
    if (body.grant) result = await grantAccess(body.grant, { name: body.name || "", addedBy: user.email });
    else if (body.revoke) result = await revokeAccess(body.revoke);
    else if (body.testColleague) result = await setTestColleague(body.testColleague, Boolean(body.on), { by: user.email });
    else if (typeof body.programYear === "string") {
      const v = body.programYear.trim();
      if (v && !/^20\d{2}(\s*[-/]\s*20\d{2})?$/.test(v)) throw new HttpError(400, 'Give the program year as "2026-2027" or "2026".');
      await setSetting("agentProgramYear", v);
      result = { changed: true, message: v ? `Program year set to ${v}. Documents with an earlier year in the title are now archive.` : "Program year follows the current cohort year again." };
    } else throw new HttpError(400, "Send { grant }, { revoke }, { testColleague, on } or { programYear }.");
  } catch (e) {
    throw new HttpError(e.status || 400, e.message);
  }
  return Response.json({ ...result, ...(await snapshot()) });
});
