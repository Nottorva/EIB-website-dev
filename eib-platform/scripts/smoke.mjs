// Regression suite for the whole platform, run against a local dev server.
//
//   npm run dev          (in another terminal, file store, no Google sign-in)
//   npm run smoke        (this; add --keep to skip the database reset)
//
// It moves data/db.json aside so the server reseeds a known sample database,
// then walks every role through every page and API route, the full
// application lifecycle (window, form rules, decisions, release, accounts,
// suspension, clean reset), the CRM, the lesson editor, submissions and
// grading, the public site and the Website admin. No dependencies: Node 18+
// fetch only. Roles are impersonated through /api/dev/switch-user, which the
// server only exposes when Google sign-in is not configured.

import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const KEEP = process.argv.includes("--keep");
const JSON_H = { "Content-Type": "application/json" };

/* ------------------------------------------------------------ harness --- */
let pass = 0, fail = 0, section = "";
const failures = [];
function check(name, want, got) {
  const ok = JSON.stringify(want) === JSON.stringify(got);
  if (ok) pass += 1;
  else {
    fail += 1;
    failures.push(`${section} › ${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}
const head = (s) => { section = s; console.log(`\n== ${s} ==`); };

/* ------------------------------------------------------------- actors --- */
// Each actor is a cookie string. The dev switch-user route sets the platform
// identity; the apply session route sets a separate applicant cookie.
async function req(cookie, method, p, body, extraHeaders = {}) {
  const res = await fetch(BASE + p, { method, headers: { ...(body !== undefined ? JSON_H : {}), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, location: res.headers.get("location") || "", setCookie: res.headers.getSetCookie ? res.headers.getSetCookie() : [] };
}
const cookieOf = (r) => r.setCookie.map((c) => c.split(";")[0]).join("; ");
async function login(email) {
  const r = await req(null, "POST", "/api/dev/switch-user", { email });
  if (r.status >= 400) throw new Error(`switch-user failed (${r.status}): is the dev server running with the file store and no Google sign-in?`);
  return cookieOf(r);
}
async function applicantSession(name, email) {
  const r = await req(null, "POST", "/api/apply/session", { name, email });
  return { cookie: cookieOf(r), status: r.status };
}
const code = async (cookie, method, p, body) => (await req(cookie, method, p, body)).status;
const words = (n) => Array(n).fill("word").join(" ");

/* ----------------------------------------------------------- database --- */
function resetDb() {
  const p = path.join(process.cwd(), "data", "db.json");
  if (!fs.existsSync(p)) return "no database yet (will be seeded on first request)";
  const backup = path.join(process.cwd(), "data", "db.smoke-backup.json");
  fs.renameSync(p, backup);
  return `moved data/db.json to data/db.smoke-backup.json; the server reseeds on the next request`;
}

/* --------------------------------------------------------------- main --- */
const started = Date.now();
if (!KEEP) console.log(resetDb());
const healthProbe = await fetch(BASE + "/api/health").catch(() => null);
if (!healthProbe) { console.error(`Nothing is listening at ${BASE}. Start the dev server first.`); process.exit(2); }

const admin = await login("josefm2173@gmail.com");
const leader = await login("jack.harlow@tfs.ca");
const student = await login("amara.chen@tfs.ca");
// Signed in with Google but holding no account: in the sandbox this is the
// only way to be "nobody", because a request with no dev cookie at all is
// treated as the seeded super admin.
const stranger = await login("__stranger__");

/* ---- 1. health and public ---- */
head("health, public site");
{
  const pub = await req(stranger, "GET", "/api/health");
  check("health public: ok only", { ok: true, keys: ["ok", "checkedAt"] }, { ok: pub.json?.ok, keys: Object.keys(pub.json || {}) });
  const adm = await req(admin, "GET", "/api/health");
  check("health admin: store + db details", ["file", true], [adm.json?.store, adm.json?.db?.ok]);
  const site = await req(null, "GET", "/");
  check("public site renders", 200, site.status);
  check("public site shows the curriculum", true, site.text.includes("Stage 01") && site.text.includes("Student Showcase"));
  check("public site leaks no deliverable or room", false, site.text.includes("Problem Journal Entry") || site.text.includes("Room 214"));
  check("public site ticker says applications are open", true, /Applications open/.test(site.text));
}

/* ---- 2. pages by role ---- */
head("pages by role");
{
  const want = {
    admin: { "/platform": 200, "/editor": 200, "/crm": 200, "/manager": 200, "/lessons": 200, "/website": 200, "/apply": 200 },
    leader: { "/platform": 200, "/editor": 307, "/crm": 200, "/manager": 200, "/lessons": 200, "/website": 307 },
    student: { "/platform": 307, "/editor": 307, "/crm": 307, "/manager": 307, "/lessons": 200, "/website": 307 },
    stranger: { "/platform": 200, "/editor": 307, "/crm": 307, "/manager": 307, "/lessons": 307, "/website": 307 },
  };
  const jars = { admin, leader, student, stranger };
  for (const [who, pages] of Object.entries(want)) {
    const got = {};
    for (const p of Object.keys(pages)) got[p] = await code(jars[who], "GET", p);
    check(`${who} pages`, pages, got);
  }
  const s = await req(student, "GET", "/platform");
  check("student hub -> lessons", "/lessons", new URL(s.location, BASE).pathname);
  const st = await req(stranger, "GET", "/lessons");
  // with Google sign-in this lands on /apply; the sandbox has no identity
  // without an account, so it is the plain denied page
  check("stranger lessons -> denied (sandbox)", "/denied", new URL(st.location, BASE).pathname);
}

/* ---- 3. lessons API ---- */
head("lessons API");
let tempLessonId = null;
{
  check("lessons: stranger (no account) -> 401", 401, await code(stranger, "GET", "/api/lessons"));
  const list = await req(student, "GET", "/api/lessons");
  check("lessons: student can list", true, list.status === 200 && Array.isArray(list.json) && list.json.length >= 4);
  check("leader POST lesson -> 403", 403, await code(leader, "POST", "/api/lessons", {}));
  const made = await req(admin, "POST", "/api/lessons", {});
  check("admin POST lesson -> 201", 201, made.status);
  tempLessonId = made.json?.id;
  check("leader PATCH room -> 200", 200, await code(leader, "PATCH", `/api/lessons/${tempLessonId}`, { room: "Room 9" }));
  check("admin PATCH session date -> saved", "Nov 17, 2026", (await req(admin, "PATCH", `/api/lessons/${tempLessonId}`, { date: "Nov 17, 2026" })).json?.date);
  check("leader PATCH mentorLocation -> 403", 403, await code(leader, "PATCH", `/api/lessons/${tempLessonId}`, { mentorLocation: "x" }));
  check("admin PATCH mentor fields -> saved", ["Library", "4:45 PM"], (({ json }) => [json?.mentorLocation, json?.mentorStartTime])(await req(admin, "PATCH", `/api/lessons/${tempLessonId}`, { mentorLocation: "Library", mentorStartTime: "4:45 PM" })));
  check("student lessons carry no mentor fields", false, (await req(student, "GET", "/api/lessons")).json.some((l) => "mentorLocation" in l || "mentorStartTime" in l || "mentorBrief" in l));
  check("leader bulk defaults -> 403", 403, await code(leader, "POST", "/api/lessons/bulk-logistics", { student: { room: "x" } }));
  const bulk = await req(admin, "POST", "/api/lessons/bulk-logistics", { student: { room: "Room 106", startTime: "4:00 PM", endTime: "5:30 PM" }, mentor: { mentorLocation: "TFS Sr. School", mentorStartTime: "4:30 PM", mentorEndTime: "5:30 PM" } });
  check("admin bulk defaults -> every lesson changed", true, bulk.status === 200 && bulk.json?.changed === bulk.json?.lessons && bulk.json?.lessons >= 4);
  {
    const after = (await req(admin, "GET", "/api/lessons")).json;
    const l1 = after.find((l) => l.number === "1");
    const l3 = after.find((l) => l.number === "3");
    check("bulk: lesson 1 (mentor) has both sets", ["Room 106", "4:00 PM", "TFS Sr. School", "4:30 PM"], [l1?.room, l1?.startTime, l1?.mentorLocation, l1?.mentorStartTime]);
    check("bulk: lesson 3 (no mentor) has student set only", ["Room 106", ""], [l3?.room, l3?.mentorLocation || ""]);
  }
  check("leader PATCH title -> 403", 403, await code(leader, "PATCH", `/api/lessons/${tempLessonId}`, { title: "x" }));
  check("leader PATCH mentorBrief -> 403", 403, await code(leader, "PATCH", `/api/lessons/${tempLessonId}`, { mentorBrief: "x" }));
  const brief = await req(admin, "PATCH", `/api/lessons/${tempLessonId}`, { mentorBrief: "Press on the problem." });
  check("admin PATCH mentorBrief -> saved", "Press on the problem.", brief.json?.mentorBrief);
  check("student list has no mentorBrief", false, (await req(student, "GET", "/api/lessons")).json.some((l) => "mentorBrief" in l));
  check("student PATCH -> 403", 403, await code(student, "PATCH", `/api/lessons/${tempLessonId}`, { room: "x" }));
  check("new lesson starts as a draft", false, Boolean(made.json?.studentVisible));
  check("draft: hidden from the student list", false, (await req(student, "GET", "/api/lessons")).json.some((l) => l.id === tempLessonId));
  check("draft: hidden from student + leader views, shown to admin", [false, false, true], [
    (await req(student, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId),
    (await req(leader, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId),
    (await req(admin, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId),
  ]);
  check("draft: still listed for leaders (manager) and admin", [true, true], [(await req(leader, "GET", "/api/lessons")).json.some((l) => l.id === tempLessonId), (await req(admin, "GET", "/api/lessons")).json.some((l) => l.id === tempLessonId)]);
  const put = await req(admin, "PUT", `/api/lessons/${tempLessonId}`, { ...made.json, title: "Smoke lesson", number: "99", mentorEnabled: true, studentVisible: true });
  check("published: student and leader views include it", [true, true], [(await req(student, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId), (await req(leader, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId)]);
  check("admin PUT lesson -> 200 with new title", ["Smoke lesson", "99"], [put.json?.title, put.json?.number]);
  check("leader DELETE lesson -> 403", 403, await code(leader, "DELETE", `/api/lessons/${tempLessonId}`));
  check("PUT missing lesson -> 404", 404, await code(admin, "PUT", "/api/lessons/nope", {}));
}

/* ---- 4. lesson view + submissions + grading ---- */
head("lesson view, submissions, grading");
{
  const sv = await req(student, "GET", "/api/lessons/view");
  check("view: student mode", "student", sv.json?.mode);
  check("view: teaching plan hidden from students", true, sv.json?.lessons.every((l) => l.teachingPlanLink === ""));
  check("view: mentor shape has no contacts", true, sv.json?.lessons.every((l) => !l.mentor || !("contacts" in l.mentor)));
  check("view: lesson 1 has its public mentor", "Trent", (sv.json?.lessons.find((l) => l.id === "lesson_1")?.mentor?.name || "").split(" ")[0]);
  const lv = await req(leader, "GET", "/api/lessons/view");
  check("view: leader mode", "leader", lv.json?.mode);

  const key = { lessonId: "lesson_1", deliverableId: "del_journal" };
  check("student PUT payload -> 200", 200, await code(student, "PUT", "/api/submissions", { ...key, payload: { text: "my entry" } }));
  check("student PUT grade -> 403", 403, await code(student, "PUT", "/api/submissions", { ...key, grade: "10" }));
  check("leader PUT payload -> 403", 403, await code(leader, "PUT", "/api/submissions", { ...key, studentId: "user_amara", payload: {} }));
  check("leader grade without studentId -> 400", 400, await code(leader, "PUT", "/api/submissions", { ...key, grade: "7" }));
  const g = await req(leader, "PUT", "/api/submissions", { ...key, studentId: "user_amara", grade: "7", feedback: "ok", released: false });
  check("leader grades (unreleased) -> 200", [200, "7", false], [g.status, g.json?.grade, g.json?.released]);
  const mine = await req(student, "GET", "/api/submissions?studentId=user_jack&lessonId=lesson_1");
  const row = mine.json?.find((s) => s.deliverableId === "del_journal");
  check("student sees own rows only (studentId param ignored)", true, (mine.json || []).every((s) => s.studentId === "user_amara"));
  check("student cannot see unreleased grade", [null, null], [row?.grade ?? null, row?.feedback || null]);
  await req(leader, "PUT", "/api/submissions", { ...key, studentId: "user_amara", grade: "7", feedback: "ok", released: true });
  const after = await req(student, "GET", "/api/submissions?lessonId=lesson_1");
  check("student sees the grade once released", "7", after.json?.find((s) => s.deliverableId === "del_journal")?.grade);
  check("leader sees every student's rows", true, (await req(leader, "GET", "/api/submissions")).json.some((s) => s.studentId === "user_amara"));
}

/* ---- 5. mentors / CRM ---- */
head("mentor CRM");
let mentorId = null;
{
  check("stranger GET mentors -> 401", 401, await code(stranger, "GET", "/api/mentors"));
  check("student GET mentors -> 403", 403, await code(student, "GET", "/api/mentors"));
  check("leader GET mentors -> 200", 200, await code(leader, "GET", "/api/mentors"));
  const made = await req(leader, "POST", "/api/mentors", {});
  check("leader creates mentor -> 201", 201, made.status);
  mentorId = made.json?.id;
  const st = await req(leader, "PATCH", `/api/mentors/${mentorId}`, { status: "confirmed", name: "Smoke Mentor" });
  check("PATCH status + name", ["confirmed", "Smoke Mentor"], [st.json?.status, st.json?.name]);
  const un = await req(leader, "PATCH", `/api/mentors/${mentorId}`, { status: "unsure" });
  check("status 'unsure' accepted", "unsure", un.json?.status);
  await req(leader, "PATCH", `/api/mentors/${mentorId}`, { status: "confirmed" });
  const yt = await req(leader, "PATCH", `/api/mentors/${mentorId}`, { years: "'26 | '27", tags: ["panelist", "bogus", "speaker"] });
  check("years saved, tags kept to the known set in order", ["'26 | '27", "speaker,panelist"], [yt.json?.years, (yt.json?.tags || []).join(",")]);
  check("assign lesson 1 (already Trent's) -> 409", 409, await code(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "1", assign: true }));
  const a = await req(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "99", assign: true });
  check("assign free lesson 99 -> 200", true, a.status === 200 && a.json.assignedLessons.some((x) => x.lessonNumber === "99"));
  const view = await req(student, "GET", "/api/lessons/view");
  check("view shows the mentor on lesson 99 without contacts", ["Smoke Mentor", false], [view.json?.lessons.find((l) => l.number === "99")?.mentor?.name, "contacts" in (view.json?.lessons.find((l) => l.number === "99")?.mentor || {})]);
  check("unassign -> 200", 200, await code(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "99", assign: false }));
  check("assign without lessonNumber -> 400", 400, await code(leader, "POST", `/api/mentors/${mentorId}/assign`, {}));
  // CRM-only events
  check("events: student -> 403, stranger -> 401", [403, 401], [await code(student, "GET", "/api/events"), await code(stranger, "GET", "/api/events")]);
  check("events: leader lists (seeded EIB Night)", "EIB Night", (await req(leader, "GET", "/api/events")).json?.events.find((e) => e.id === "event_eib_night")?.title);
  check("leader POST event -> 403", 403, await code(leader, "POST", "/api/events", { title: "x" }));
  const evMade = await req(admin, "POST", "/api/events", { title: "Smoke panel", anchor: "1", rank: 3 });
  check("admin POST event -> 201 with anchor", [201, "1", 3], [evMade.status, evMade.json?.anchor, evMade.json?.rank]);
  const evId = evMade.json?.id;
  check("leader PATCH event title -> 403", 403, await code(leader, "PATCH", `/api/events/${evId}`, { title: "x" }));
  const onEv = await req(leader, "PATCH", `/api/events/${evId}`, { mentorIds: [mentorId, mentorId, "ghost"] });
  check("leader PATCH event people -> deduped list", [200, `${mentorId},ghost`], [onEv.status, (onEv.json?.mentorIds || []).join(",")]);
  const moved = await req(admin, "PATCH", `/api/events/${evId}`, { anchor: "start", rank: -1, date: "Nov 3, 2026" });
  check("admin moves event + sets date", ["start", -1, "Nov 3, 2026"], [moved.json?.anchor, moved.json?.rank, moved.json?.date]);
  check("student view carries no events", false, JSON.stringify((await req(student, "GET", "/api/lessons/view")).json || {}).includes("Smoke panel"));
  check("leader DELETE event -> 403", 403, await code(leader, "DELETE", `/api/events/${evId}`));
  check("admin DELETE event -> 200", 200, await code(admin, "DELETE", `/api/events/${evId}`));
}

/* ---- 6. accounts: leaders, advancement team ---- */
head("accounts");
let advCookie = null;
{
  check("leader lists users -> 403", 403, await code(leader, "GET", "/api/users"));
  const lead = await req(admin, "POST", "/api/users", { name: "Smoke Leader", email: `smoke.leader@tfs.ca` });
  check("admin creates leader -> 201 studentLeader", [201, "studentLeader"], [lead.status, lead.json?.role]);
  check("duplicate email -> 409", 409, await code(admin, "POST", "/api/users", { name: "Again", email: "smoke.leader@tfs.ca" }));
  check("leader creates advancement -> 403", 403, await code(leader, "POST", "/api/users", { email: "x@example.com", role: "advancement" }));
  const adv = await req(admin, "POST", "/api/users", { email: "smoke.adv@example.com", role: "advancement" });
  check("admin creates advancement from email only", [201, "advancement", "Smoke Adv"], [adv.status, adv.json?.role, adv.json?.name]);
  advCookie = await login("smoke.adv@example.com");
  const got = {};
  for (const p of ["/crm", "/manager", "/editor", "/lessons", "/website"]) got[p] = await code(advCookie, "GET", p);
  check("advancement pages: CRM only", { "/crm": 200, "/manager": 307, "/editor": 307, "/lessons": 307, "/website": 307 }, got);
  check("advancement hub -> /crm", "/crm", new URL((await req(advCookie, "GET", "/platform")).location, BASE).pathname);
  check("advancement API: mentors 200, applications 403, settings 200", [200, 403, 200], [await code(advCookie, "GET", "/api/mentors"), await code(advCookie, "GET", "/api/applications"), await code(advCookie, "GET", "/api/settings")]);
  check("leader deletes advancement -> 403", 403, await code(leader, "DELETE", `/api/users/${adv.json.id}`));
  check("admin deletes advancement -> 200", 200, await code(admin, "DELETE", `/api/users/${adv.json.id}`));
  check("deleted advancement can no longer open the CRM", 307, await code(advCookie, "GET", "/crm"));
  check("admin deletes leader -> 200", 200, await code(admin, "DELETE", `/api/users/${lead.json.id}`));
  check("admin deletes a student via users route -> 403", 403, await code(admin, "DELETE", "/api/users/user_amara"));
  check("admin deletes self -> refused", 403, await code(admin, "DELETE", "/api/users/user_josef"));
  const sus = await req(admin, "PATCH", "/api/users/user_amara", { suspended: true });
  check("admin suspends student", true, sus.json?.suspended);
  check("suspended student lessons -> 307", 307, await code(student, "GET", "/lessons"));
  check("leader suspends -> 403", 403, await code(leader, "PATCH", "/api/users/user_amara", { suspended: false }));
  await req(admin, "PATCH", "/api/users/user_amara", { suspended: false });
  check("reinstated student lessons -> 200", 200, await code(student, "GET", "/lessons"));
}

/* ---- 7. application window ---- */
head("application window");
const GOOD = (extra = {}) => ({ answers: Object.entries({ q_intro: "I understand", q_level: "Level 3", q_start: "I have a venture already running", q_started: "", q_problem: "p", q_skill: "s", q_failed: "f", q_field: "robotics", q_learn: "learn", q_true: "true", q_schedule: "I understand", q_fee: "I understand", ...extra }).map(([questionId, answer]) => ({ questionId, answer })) });
{
  check("student sets window -> 403", 403, await code(student, "PUT", "/api/application-window", { closesAt: null }));
  const closed = await req(leader, "PUT", "/api/application-window", { opensAt: null, closesAt: "2020-01-01T00:00:00Z" });
  check("leader closes window", "closed", closed.json?.state);
  check("public status says closed", "closed", (await req(null, "GET", "/api/apply/status")).json?.state);
  check("close before open -> 400", 400, await code(leader, "PUT", "/api/application-window", { opensAt: "2099-06-01T00:00:00Z", closesAt: "2099-01-01T00:00:00Z" }));
  check("bad date -> 400", 400, await code(leader, "PUT", "/api/application-window", { closesAt: "yesterday" }));
  const up = await req(leader, "PUT", "/api/application-window", { opensAt: "2099-01-01T00:00:00Z", closesAt: "2099-06-01T00:00:00Z" });
  check("future window -> upcoming", "upcoming", up.json?.state);
  check("public site ticker: opens <date>", true, /Applications open [A-Z][a-z]+ \d/.test((await req(null, "GET", "/")).text));
  const open = await req(leader, "PUT", "/api/application-window", { opensAt: null, closesAt: null, applicantDomain: "TFS.ca" });
  check("blank window -> open, domain normalised", ["open", "tfs.ca"], [open.json?.state, open.json?.applicantDomain]);
}

/* ---- 8. applying ---- */
head("applying");
let appId = null;
const EMAIL = "Smoke.Applicant@tfs.ca";
let applicant = null;
{
  check("apply without sign-in -> 401", 401, await code(null, "POST", "/api/apply", GOOD()));
  check("session with wrong domain -> 403", 403, (await applicantSession("X", "x@gmail.com")).status);
  // the applicant cookie rides alongside the stranger identity, as it would
  // next to a Google session for an account-less person
  applicant = stranger + "; " + (await applicantSession("Smoke Applicant", EMAIL)).cookie;
  const st = await req(applicant, "GET", "/api/apply/status");
  check("status: applicant email lowercased", "smoke.applicant@tfs.ca", st.json?.applicant?.email);
  check("status: no name/email questions in the form", 0, st.json?.form.filter((q) => q.key === "name" || q.key === "email").length);
  check("status: form title", "EIB Application 2026-27", st.json?.title);
  check("status: previewer flag only for the super admin", [true, false, false], [(await req(admin, "GET", "/api/apply/status")).json?.previewer, (await req(leader, "GET", "/api/apply/status")).json?.previewer, st.json?.previewer]);
  check("missing required -> 400", 400, await code(applicant, "POST", "/api/apply", { answers: [{ questionId: "q_level", answer: "Level 3" }] }));
  check("notice not ticked -> 400", 400, await code(applicant, "POST", "/api/apply", GOOD({ q_fee: "" })));
  check("notice wrong text -> 400", 400, await code(applicant, "POST", "/api/apply", GOOD({ q_fee: "yes" })));
  // unfinished application: saved as they type, visible to the manager, restored on return
  check("draft without sign-in -> 401", 401, await code(null, "POST", "/api/apply/draft", { answers: [] }));
  check("applicant saves a draft -> 200", 200, await code(applicant, "POST", "/api/apply/draft", { answers: [{ questionId: "q_intro", answer: "Half done" }] }));
  const drafts = await req(leader, "GET", "/api/applications/drafts");
  check("leader sees the unfinished application", ["Half done"], (drafts.json || []).filter((d) => d.email === "smoke.applicant@tfs.ca").map((d) => d.answers[0]?.answer));
  check("student GET drafts -> 403", 403, await code(student, "GET", "/api/applications/drafts"));
  check("status returns the draft to the applicant", "Half done", (await req(applicant, "GET", "/api/apply/status")).json?.draft?.answers?.[0]?.answer);
  await Promise.all([1, 2, 3, 4].map((i) => req(applicant, "POST", "/api/apply/draft", { answers: [{ questionId: "q_intro", answer: `Half done ${i}` }] })));
  check("four saves at once -> still one draft row", 1, (await req(leader, "GET", "/api/applications/drafts")).json.filter((d) => d.email === "smoke.applicant@tfs.ca").length);
  check("251 words -> 400", 400, await code(applicant, "POST", "/api/apply", GOOD({ q_problem: words(251) })));
  const ok = await req(applicant, "POST", "/api/apply", GOOD({ q_problem: words(250) }));
  check("250 words, optional blank -> 201", 201, ok.status);
  appId = ok.json?.id;
  check("second application same email -> 409", 409, await code(applicant, "POST", "/api/apply", GOOD()));
  const st2 = await req(applicant, "GET", "/api/apply/status");
  check("status: alreadyApplied, no decision yet", [true, null], [st2.json?.alreadyApplied, st2.json?.application?.decision]);
  const list = await req(leader, "GET", "/api/applications");
  const mine = list.json?.find((a) => a.id === appId);
  check("manager list: pending, name/email from sign-in, 12 answers", ["pending", "Smoke Applicant", "smoke.applicant@tfs.ca", 12], [mine?.status, mine?.name, mine?.email, mine?.answers.length]);
  check("student lists applications -> 403", 403, await code(student, "GET", "/api/applications"));
}

/* ---- 9. decisions, release, accounts ---- */
{
  const after = await req(admin, "GET", "/api/applications/drafts");
  check("draft gone once submitted", false, (after.json || []).some((d) => d.email === "smoke.applicant@tfs.ca"));
  // super admin submits an unfinished application on the applicant's behalf
  const half = stranger + "; " + (await applicantSession("Half Way", "half.way@tfs.ca")).cookie;
  await req(half, "POST", "/api/apply/draft", { answers: [{ questionId: "q_problem", answer: "Only this much." }] });
  const draftRow = (await req(admin, "GET", "/api/applications/drafts")).json.find((d) => d.email === "half.way@tfs.ca");
  check("leader cannot submit for them -> 403", 403, await code(leader, "POST", `/api/applications/drafts/${draftRow?.id}/submit`));
  const forced = await req(admin, "POST", `/api/applications/drafts/${draftRow?.id}/submit`);
  check("admin submits for them -> 201 pending with their answer", [201, "pending", "Only this much."], [forced.status, forced.json?.status, forced.json?.answers?.find((a) => a.questionId === "q_problem")?.answer]);
  check("their draft is gone", false, (await req(admin, "GET", "/api/applications/drafts")).json.some((d) => d.email === "half.way@tfs.ca"));
  check("they now appear in applications", true, (await req(leader, "GET", "/api/applications")).json.some((a) => a.email === "half.way@tfs.ca"));
  check("submit again -> 404 (draft gone)", 404, await code(admin, "POST", `/api/applications/drafts/${draftRow?.id}/submit`));
  check("their status page says applied", true, (await req(half, "GET", "/api/apply/status")).json?.alreadyApplied);
  check("clean reset of the forced application", 200, await code(admin, "DELETE", `/api/applications/${forced.json?.id}`));
}

head("decisions and release");
{
  const acct = async () => { const u = (await req(admin, "GET", "/api/users?role=student")).json.find((x) => x.email === "smoke.applicant@tfs.ca"); return u ? (u.suspended ? "suspended" : "active") : "none"; };
  const setStatus = (s) => code(leader, "PATCH", `/api/applications/${appId}`, { status: s });
  const release = () => req(admin, "POST", "/api/applications/release", {});
  check("unknown status -> 400", 400, await setStatus("maybe"));
  check("leader approves -> 200", 200, await setStatus("approved"));
  check("approve alone creates no account, not released", ["none", false], [await acct(), (await req(leader, "GET", `/api/applications/${appId}`)).json?.decisionReleased]);
  check("applicant sees no decision before release", null, (await req(applicant, "GET", "/api/apply/status")).json?.application?.decision);
  check("leader releases -> 403", 403, await code(leader, "POST", "/api/applications/release", {}));
  const r = await release();
  check("admin releases: 1 account created", [1, 1], [r.json?.accountsCreated, r.json?.approved]);
  check("account active, applicant sees approved", ["active", "approved"], [await acct(), (await req(applicant, "GET", "/api/apply/status")).json?.application?.decision]);
  check("application carries studentId", true, Boolean((await req(leader, "GET", `/api/applications/${appId}`)).json?.studentId));
  const newStudent = await login("smoke.applicant@tfs.ca");
  check("new student: first visit goes to the welcome page", "/welcome", new URL((await fetch(`${BASE}/lessons`, { headers: { Cookie: newStudent }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname);
  await req(newStudent, "POST", "/api/welcome", {});
  check("new student can open lessons after the welcome", 200, await code(newStudent, "GET", "/lessons"));
  await setStatus("waitlist");
  check("moved to waitlist -> account suspended, decision unreleased", ["suspended", false], [await acct(), (await req(leader, "GET", `/api/applications/${appId}`)).json?.decisionReleased]);
  check("suspended student lessons -> 307", 307, await code(newStudent, "GET", "/lessons"));
  await release();
  check("waitlist released -> applicant sees waitlist, still suspended", ["waitlist", "suspended"], [(await req(applicant, "GET", "/api/apply/status")).json?.application?.decision, await acct()]);
  await setStatus("approved"); await release();
  check("re-approved + released -> active again", "active", await acct());
  await setStatus("denied");
  check("denied -> suspended", "suspended", await acct());
  check("leader clean-resets -> 403", 403, await code(leader, "DELETE", `/api/applications/${appId}`));
  const del = await req(admin, "DELETE", `/api/applications/${appId}`);
  check("admin clean reset removes application + account", [200, 1, 1], [del.status, del.json?.removed?.application, del.json?.removed?.account]);
  check("application gone, account gone", [404, "none"], [await code(leader, "GET", `/api/applications/${appId}`), await acct()]);
  check("same email can apply again", 201, await code(applicant, "POST", "/api/apply", GOOD()));
  check("clean reset again -> 404", 404, await code(admin, "DELETE", `/api/applications/${appId}`));
}

/* ---- 10. the form ---- */
head("application form");
{
  const orig = (await req(null, "GET", "/api/form")).json;
  check("public can read the form", true, Array.isArray(orig) && orig.length === 12);
  check("student saves form -> 403", 403, await code(student, "PUT", "/api/form", []));
  const saved = await req(leader, "PUT", "/api/form", [
    { id: "q_name", key: "name", locked: true, type: "short", label: "Full name", required: true, options: [] },
    { id: "q_n", type: "notice", label: "Fee", detail: "Charged on acceptance.", ack: "  ", required: true, options: [] },
    { id: "q_l", type: "long", label: "Long", help: "About 150 words.", maxWords: 250, required: true, options: [] },
    { id: "q_f", type: "file", label: "Old file type", required: false, options: [] },
  ]);
  check("identity questions dropped on save", ["q_n", "q_l", "q_f"], saved.json?.map((q) => q.id));
  check("blank ack falls back to I understand; detail kept", ["I understand", "Charged on acceptance."], [saved.json?.[0].ack, saved.json?.[0].detail]);
  check("help + maxWords kept on long answers", ["About 150 words.", 250], [saved.json?.[1].help, saved.json?.[1].maxWords]);
  check("legacy file type becomes link", "link", saved.json?.[2].type);
  check("leader resets to canonical -> 403", 403, await code(leader, "POST", "/api/form/reset", {}));
  const reset = await req(admin, "POST", "/api/form/reset", {});
  check("admin resets to the 2026-27 form", [12, "q_intro", "q_fee"], [reset.json?.length, reset.json?.[0].id, reset.json?.[11].id]);
}

/* ---- 11. website admin ---- */
/* ---- student agreement: upload, gate, sign ---- */
head("student agreement");
{
  const tinyPdf = () => {
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>"];
    const stream = "BT /F1 24 Tf 72 700 Td (EIB Student Agreement) Tj ET";
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    let out = "%PDF-1.4\n"; const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  };
  const upload = async (cookie) => {
    const fd = new FormData();
    fd.append("file", new Blob([tinyPdf()], { type: "application/pdf" }), "agreement.pdf");
    const r = await fetch(`${BASE}/api/agreement/pdf`, { method: "POST", headers: { Cookie: cookie }, body: fd });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  check("leader cannot upload the agreement -> 403", 403, (await upload(leader)).status);
  check("student view open while no PDF", 200, await code(student, "GET", "/api/lessons/view"));
  const up = await upload(admin);
  check("admin uploads the PDF -> 201, version 1", [201, 1, "agreement.pdf"], [up.status, up.json?.version, up.json?.pdf?.name]);
  check("student now blocked from lessons view -> 403", 403, await code(student, "GET", "/api/lessons/view"));
  check("student GET /api/agreement: pending", true, (await req(student, "GET", "/api/agreement")).json?.pending);
  const pdfRes = await fetch(`${BASE}/api/agreement/pdf`, { headers: { Cookie: student } });
  check("student can fetch the PDF", [200, "application/pdf"], [pdfRes.status, pdfRes.headers.get("content-type")]);
  check("stranger cannot fetch the PDF -> 401", 401, (await fetch(`${BASE}/api/agreement/pdf`, { headers: { Cookie: stranger } })).status);
  const good = { readConfirmed: true, studentSignature: "Amara Chen", parentSignature: "Mei Chen", parentEmail: "mei.chen@example.com", parentRelationship: "Mother", parentConfirmed: true };
  check("sign without parent confirm -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, parentConfirmed: false }));
  check("sign with a bad signature -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, studentSignature: "123" }));
  check("leader cannot sign -> 403", 403, await code(leader, "POST", "/api/agreement/accept", good));
  const outbox = () => { try { return fs.readFileSync("data/outbox.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const tokenOf = (entry) => (entry?.text.match(/token=([a-f0-9]{64})/) || [])[1];
  const before = outbox().length;
  const signed = await req(student, "POST", "/api/agreement/accept", good);
  check("student submits -> 200, pending, guardian emailed", [200, "pending", "Mei Chen", "2026-27", true], [signed.status, signed.json?.agreement?.status, signed.json?.agreement?.parentName, signed.json?.agreement?.versionLabel, outbox().length === before + 1]);
  check("record has no token, email masked", [false, "m…@example.com"], ["confirmation" in (signed.json?.agreement || {}), signed.json?.agreement?.parentEmailMasked]);
  // the sample student applied before the fee notice existed, so hers is null; the field itself must be there
  check("fee acknowledgement field present on the record", true, "feeAcknowledgement" in (signed.json?.agreement || {}));
  check("still pending: lessons view -> 403", 403, await code(student, "GET", "/api/lessons/view"));
  check("status: record pending for the student", "pending", (await req(student, "GET", "/api/agreement")).json?.record?.status);
  check("resend within 10 minutes -> 429", 429, await code(student, "POST", "/api/agreement/resend", {}));
  const mail = outbox().slice(-1)[0];
  check("email goes to the guardian with a link", ["mei.chen@example.com", true], [mail?.to, Boolean(tokenOf(mail))]);
  check("bad token -> invalid page", true, (await fetch(`${BASE}/api/agreement/confirm?token=${"0".repeat(64)}`, { redirect: "manual" })).headers.get("location")?.includes("state=invalid"));
  // expired path (sandbox hook), then a fresh link from the expired page
  const amaraId = (await req(admin, "GET", "/api/users?role=student")).json.find((u) => u.email === "amara.chen@tfs.ca")?.id;
  check("dev: expire the link", 200, await code(admin, "POST", "/api/dev/expire-agreement", { userId: amaraId }));
  const expired = await fetch(`${BASE}/api/agreement/confirm?token=${tokenOf(mail)}`, { redirect: "manual" });
  check("expired link -> expired page carrying the token", true, expired.headers.get("location")?.includes("state=expired") && expired.headers.get("location")?.includes("token="));
  check("new link from the expired page -> 429 inside the cooldown", 429, (await fetch(`${BASE}/api/agreement/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenOf(mail) }) })).status);
  const adminResend = await req(admin, "POST", "/api/agreement/resend", { userId: amaraId });
  check("admin resend bypasses the cooldown -> 200, new email", [200, before + 2], [adminResend.status, outbox().length]);
  const fresh = tokenOf(outbox().slice(-1)[0]);
  check("old link now invalid (replaced)", true, (await fetch(`${BASE}/api/agreement/confirm?token=${tokenOf(mail)}`, { redirect: "manual" })).headers.get("location")?.includes("state=invalid"));
  const ok = await fetch(`${BASE}/api/agreement/confirm?token=${fresh}`, { redirect: "manual" });
  check("guardian clicks the fresh link -> ok page", true, ok.headers.get("location")?.includes("state=ok"));
  check("same link again -> used page", true, (await fetch(`${BASE}/api/agreement/confirm?token=${fresh}`, { redirect: "manual" })).headers.get("location")?.includes("state=used"));
  check("confirmed page renders for the guardian", true, (await req(null, "GET", "/agreement/confirmed?state=ok&student=Amara")).text.includes("Thank you"));
  check("student view open again", 200, await code(student, "GET", "/api/lessons/view"));
  const row = (await req(admin, "GET", "/api/users?role=student")).json.find((u) => u.email === "amara.chen@tfs.ca");
  check("admin sees signed + confirmation time + guardian", ["signed", true, "Mother"], [row?.agreement?.status, Boolean(row?.agreement?.confirmedAt), row?.agreement?.parentRelationship]);
  check("resend after signed -> 409", 409, await code(student, "POST", "/api/agreement/resend", {}));
  const up2 = await upload(admin);
  check("replacing the PDF -> version 2 and the student must sign again", [2, 403], [up2.json?.version, await code(student, "GET", "/api/lessons/view")]);
  check("switching required off reopens lessons", [200, 200], [await code(admin, "PUT", "/api/agreement", { required: false }), await code(student, "GET", "/api/lessons/view")]);
  check("leader cannot change the settings -> 403", 403, await code(leader, "PUT", "/api/agreement", { required: true }));
  check("admin removes the PDF", 200, await code(admin, "DELETE", "/api/agreement/pdf"));
  await req(admin, "PUT", "/api/agreement", { required: true });
}

/* ---- the test student account ---- */
head("test account");
{
  check("leader cannot create a test account -> 403", 403, await code(leader, "POST", "/api/test-account", { email: "tester@tfs.ca" }));
  check("none to begin with", null, (await req(admin, "GET", "/api/test-account")).json?.account);
  check("bad email -> 400", 400, await code(admin, "POST", "/api/test-account", { email: "nope" }));
  check("existing email -> 409", 409, await code(admin, "POST", "/api/test-account", { email: "amara.chen@tfs.ca" }));
  const made = await req(admin, "POST", "/api/test-account", { email: "Tester@tfs.ca" });
  check("admin creates it -> 201, named Test, lowercased", [201, "Test", "tester@tfs.ca"], [made.status, made.json?.account?.name, made.json?.account?.email]);
  check("only one -> 409", 409, await code(admin, "POST", "/api/test-account", { email: "other@tfs.ca" }));
  const tester = await login("tester@tfs.ca");
  check("test account is a student: lessons view 200, manager 403", [200, 403], [await code(tester, "GET", "/api/lessons/view"), await code(tester, "GET", "/api/applications")]);
  // first sign-in: the welcome page comes before lessons and onboarding
  check("new student: /lessons -> /welcome, /onboarding -> /welcome", ["/welcome", "/welcome"], [new URL((await fetch(`${BASE}/lessons`, { headers: { Cookie: tester }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname, new URL((await fetch(`${BASE}/onboarding`, { headers: { Cookie: tester }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname]);
  check("welcome page renders", true, (await req(tester, "GET", "/welcome")).text.includes("Congratulations"));
  const welcomed = await req(tester, "POST", "/api/welcome", {});
  check("pressing the button -> next is lessons (no agreement PDF now)", [200, "/lessons"], [welcomed.status, welcomed.json?.next]);
  check("after that: /lessons 200, /welcome -> /lessons", [200, "/lessons"], [await code(tester, "GET", "/lessons"), new URL((await fetch(`${BASE}/welcome`, { headers: { Cookie: tester }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname]);
  check("leader cannot press welcome -> 403", 403, await code(leader, "POST", "/api/welcome", {}));
  const first = (await req(tester, "GET", "/api/lessons/view")).json.lessons[0];
  const del = first?.deliverables?.[0];
  if (del) {
    const sub = await req(tester, "PUT", "/api/submissions", { lessonId: first.id, deliverableId: del.id, payload: { text: "test work" } });
    check("test account submits work", true, sub.status === 200 || sub.status === 201);
  }
  check("applications count unchanged by the test account", false, (await req(admin, "GET", "/api/applications")).json.some((a) => a.email === "tester@tfs.ca"));
  const wiped = await req(admin, "PATCH", "/api/test-account");
  check("wipe -> account kept, work gone", [200, "tester@tfs.ca", del ? 1 : 0], [wiped.status, wiped.json?.account?.email, wiped.json?.removed?.submissions]);
  check("after wipe: no submissions for the tester", 0, (await req(tester, "GET", "/api/lessons/view")).json.submissions.length);
  check("after wipe: the welcome page shows again", "/welcome", new URL((await fetch(`${BASE}/lessons`, { headers: { Cookie: tester }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname);
  check("remove -> gone", [200, null], [await code(admin, "DELETE", "/api/test-account"), (await req(admin, "GET", "/api/test-account")).json?.account]);
  check("removed account can no longer sign in -> 401", 401, await code(tester, "GET", "/api/lessons/view"));
}

head("website admin");
{
  check("stranger /api/site -> 401", 401, await code(stranger, "GET", "/api/site"));
  check("leader /api/site -> 403", 403, await code(leader, "GET", "/api/site"));
  const s = await req(admin, "GET", "/api/site");
  check("admin reads ticker + default", true, Array.isArray(s.json?.ticker) && Array.isArray(s.json?.defaultTicker));
  const t = await req(admin, "PUT", "/api/site", { ticker: ["  First  ", "", "Second", null, ...Array(20).fill("x")] });
  check("ticker cleaned: trimmed, blanks dropped, max 12", [12, "First", "Second"], [t.json?.ticker.length, t.json?.ticker[0], t.json?.ticker[1]]);
  check("site shows the saved ticker item", true, (await req(null, "GET", "/")).text.includes("Second"));
  const slides = await req(stranger, "GET", "/slides");
  check("slides page is public and names the deck", [200, true], [slides.status, slides.text.includes("EIB Night 2027")]);
  check("home bar links to the slides", true, (await req(stranger, "GET", "/")).text.includes('href="/slides"'));
  for (const [p, title] of [["/privacy", "Privacy Policy"], ["/terms", "Terms and Conditions"], ["/cookies", "Cookie Policy"]]) {
    const r = await req(stranger, "GET", p);
    check(`${p} is public and titled`, [200, true], [r.status, r.text.includes(title)]);
  }
  check("home footer links to the legal pages", true, ((t) => t.includes('href="/privacy"') && t.includes('href="/terms"') && t.includes('href="/cookies"'))((await req(stranger, "GET", "/")).text));
  check("home has a skip link", true, (await req(stranger, "GET", "/")).text.includes('class="skiplink"'));
  const pdf = await fetch(`${BASE}/site/eib-night-2027.pdf`, { method: "HEAD" });
  check("deck PDF served", [200, "application/pdf"], [pdf.status, pdf.headers.get("content-type")]);
  await req(admin, "PUT", "/api/site", { ticker: s.json.defaultTicker });
  check("empty testimonial -> 400", 400, await code(admin, "POST", "/api/site/testimonials", { quote: "  " }));
  check("leader creates testimonial -> 403", 403, await code(leader, "POST", "/api/site/testimonials", { quote: "x" }));
  const made = await req(admin, "POST", "/api/site/testimonials", { quote: "Real words.", name: "Test Person", role: "Student", approved: false });
  check("admin creates testimonial -> 201", 201, made.status);
  const appr = await req(admin, "PUT", `/api/site/testimonials/${made.json.id}`, { approved: true });
  check("approve keeps the other fields", ["Test Person", true], [appr.json?.name, appr.json?.approved]);
  check("delete -> 200 then 404", [200, 404], [await code(admin, "DELETE", `/api/site/testimonials/${made.json.id}`), await code(admin, "DELETE", `/api/site/testimonials/${made.json.id}`)]);
}

/* ---- 12. settings ---- */
head("settings");
{
  check("student settings -> 403", 403, await code(student, "GET", "/api/settings"));
  const g = await req(leader, "GET", "/api/settings");
  check("leader reads cohort year + cap", [2026, 23], [g.json?.cohortYear, g.json?.classSizeCap]);
  check("leader changes cap -> 403", 403, await code(leader, "PATCH", "/api/settings", { classSizeCap: 25 }));
  check("cap 0 -> 400", 400, await code(admin, "PATCH", "/api/settings", { classSizeCap: 0 }));
  check("cap 25 -> 200", 25, (await req(admin, "PATCH", "/api/settings", { classSizeCap: 25 })).json?.classSizeCap);
  await req(admin, "PATCH", "/api/settings", { classSizeCap: 23 });
}

/* ---- cleanup of things this run created that later runs would trip on ---- */
head("cleanup");
{
  check("admin deletes the smoke lesson", 200, await code(admin, "DELETE", `/api/lessons/${tempLessonId}`));
  check("admin deletes the smoke mentor", 200, await code(admin, "DELETE", `/api/mentors/${mentorId}`));
}

/* ------------------------------------------------------------ summary --- */
console.log(`\n${fail === 0 ? "ALL GOOD" : "FAILURES"}: passed ${pass}, failed ${fail} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (failures.length) console.log(failures.map((f) => "  - " + f).join("\n"));
process.exit(fail === 0 ? 0 : 1);
