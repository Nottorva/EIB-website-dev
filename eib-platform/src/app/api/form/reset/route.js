// Super admin only: replace the saved application form with the canonical
// 2026-27 application from code. Everything currently in the form is
// dropped; existing applications keep their answers (they are stored by
// question id).
import { guarded } from "@/lib/auth";
import { saveApplicationForm } from "@/lib/data/settings";
import { APPLICATION_FORM_2026 } from "@/lib/data/applicationForm2026";

export const POST = guarded(["superAdmin"], async () => Response.json(await saveApplicationForm(APPLICATION_FORM_2026)));
