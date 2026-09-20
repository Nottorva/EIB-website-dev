// POST: release every unreleased final decision (super admin only). This is
// the step that creates student accounts for approved applicants.
import { guarded } from "@/lib/auth";
import { releaseDecisions } from "@/lib/data/applications";

export const POST = guarded(["superAdmin"], async () => Response.json(await releaseDecisions()));
