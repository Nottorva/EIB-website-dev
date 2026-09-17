// GET /api/health
// Public, no secrets: which backends are active and whether the database
// answers. Open it after a deploy to confirm the wiring:
//   { store: "mongo", auth: "google", db: { ok: true, users: 1 } }
import { open } from "@/lib/auth";
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
  return Response.json(
    {
      ok: db.ok,
      store: storeMode,
      auth: authMode,
      db,
      env: process.env.VERCEL ? "vercel" : "local",
      checkedAt: new Date().toISOString(),
    },
    { status: db.ok ? 200 : 503 }
  );
});
