// Unfinished applications: people who signed in to the form and have not
// submitted. Same readers as the applications themselves.
import { guarded } from "@/lib/auth";
import { listDrafts } from "@/lib/data/drafts";

export const GET = guarded(["superAdmin", "studentLeader"], async () => Response.json(await listDrafts()));
