import { guarded } from "@/lib/auth";
import { listApplications } from "@/lib/data/applications";

export const GET = guarded(["superAdmin", "studentLeader"], async () => Response.json(await listApplications()));
