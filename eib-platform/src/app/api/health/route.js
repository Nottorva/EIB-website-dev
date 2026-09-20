// GET /api/health
// Anyone gets { ok }. The super admin also gets which backends are active
// and whether the database answers (no data, no secrets).
import { open, getCurrentUser } from "@/lib/auth";
import { storeMode, findAll } from "@/lib/data/store";
import { authMode } from "@/lib/auth";

export const GET = open(async () => {
  const started = Date.now();
  let db;
  try {
    const users = await findAll("users");
    db = { ok: true, users: users.length, ms: Date.now() - started };
  } catch (e) {
    db = { ok: false, error: String(e?.message || e).slice(0, 200), ms: Date.now() - started };
  }
  const user = await getCurrentUser().catch(() => null);
  const detail = user?.role === "superAdmin" ? { store: storeMode, auth: authMode, db, env: process.env.VERCEL ? "vercel" : "local" } : {};
  return Response.json({ ok: db.ok, ...detail, checkedAt: new Date().toISOString() }, { status: db.ok ? 200 : 503 });
});
