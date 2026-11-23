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
    admin: { "/platform": 200, "/editor": 200, "/crm": 200, "/manager": 200, "/grading": 200, "/lessons": 200, "/website": 200, "/apply": 200 },
    leader: { "/platform": 200, "/editor": 307, "/crm": 200, "/manager": 200, "/grading": 200, "/lessons": 200, "/website": 307 },
    student: { "/platform": 307, "/editor": 307, "/crm": 307, "/manager": 307, "/grading": 307, "/lessons": 200, "/website": 307 },
    stranger: { "/platform": 200, "/editor": 307, "/crm": 307, "/manager": 307, "/grading": 307, "/lessons": 307, "/website": 307 },
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
  const put = await req(admin, "PUT", `/api/lessons/${tempLessonId}`, { ...made.json, title: "Smoke lesson", number: "99", mentorEnabled: true, mentorSeats: 2, studentVisible: true });
  check("published: student and leader views include it", [true, true], [(await req(student, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId), (await req(leader, "GET", "/api/lessons/view")).json.lessons.some((l) => l.id === tempLessonId)]);
  check("admin PUT lesson -> 200 with new title and two mentor seats", ["Smoke lesson", "99", 2], [put.json?.title, put.json?.number, put.json?.mentorSeats]);
  check("lesson 1 (Yes Mentor) has one seat by default", 1, (await req(admin, "GET", "/api/lessons")).json.find((l) => l.id === "lesson_1")?.mentorSeats);
  check("leader DELETE lesson -> 403", 403, await code(leader, "DELETE", `/api/lessons/${tempLessonId}`));
  // slides + teaching plan are uploaded files
  {
    const uploadFile = async (cookie, kind, name, bytes, type) => { const fd = new FormData(); fd.append("file", new Blob([bytes], { type }), name); const r = await fetch(`${BASE}/api/lessons/${tempLessonId}/file/${kind}`, { method: "POST", headers: { Cookie: cookie }, body: fd }); return { status: r.status, json: await r.json().catch(() => null) }; };
    check("leader uploads slides -> 403", 403, (await uploadFile(leader, "slides", "deck.pdf", "%PDF-1.4 x", "application/pdf")).status);
    const up = await uploadFile(admin, "slides", "deck.pdf", "%PDF-1.4 slides", "application/pdf");
    check("admin uploads slides -> 201, link set to the file URL", [201, "deck.pdf", `/api/lessons/${tempLessonId}/file/slides`], [up.status, up.json?.slidesFile?.name, up.json?.slidesLink]);
    const plan = await uploadFile(admin, "teachingPlan", "plan.docx", "PK plan", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    check("admin uploads teaching plan -> 201", 201, plan.status);
    const got = await fetch(`${BASE}/api/lessons/${tempLessonId}/file/slides`, { headers: { Cookie: student } });
    check("student opens slides -> 200 pdf", [200, "application/pdf"], [got.status, got.headers.get("content-type")]);
    check("student opens teaching plan -> 403, leader -> 200", [403, 200], [(await fetch(`${BASE}/api/lessons/${tempLessonId}/file/teachingPlan`, { headers: { Cookie: student } })).status, (await fetch(`${BASE}/api/lessons/${tempLessonId}/file/teachingPlan`, { headers: { Cookie: leader } })).status]);
    check("student lesson list carries slides meta but no teaching plan meta", [true, false], (({ json }) => { const l = json.find((x) => x.id === tempLessonId); return [Boolean(l?.slidesFile), "teachingPlanFile" in (l || {})]; })(await req(student, "GET", "/api/lessons")));
    check("wrong kind -> 404", 404, (await fetch(`${BASE}/api/lessons/${tempLessonId}/file/homework`, { headers: { Cookie: admin } })).status);
    const rm = await req(admin, "DELETE", `/api/lessons/${tempLessonId}/file/slides`);
    check("remove slides -> link cleared, file 404", [200, "", 404], [rm.status, rm.json?.slidesLink, (await fetch(`${BASE}/api/lessons/${tempLessonId}/file/slides`, { headers: { Cookie: admin } })).status]);
  }
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
  // a late typing save (grade + feedback, no release flag) must not undo the release
  check("grade edit without a release flag keeps it released", ["8", true], (({ json }) => [json?.grade, json?.released])(await req(leader, "PUT", "/api/submissions", { ...key, studentId: "user_amara", grade: "8", feedback: "ok" })));
  await req(leader, "PUT", "/api/submissions", { ...key, studentId: "user_amara", grade: "7", feedback: "ok" });
  // the Grading tool's one read
  const gr = await req(leader, "GET", "/api/grading");
  check("grading: leader gets class list, lessons, submissions", [200, true, true, true], [gr.status, gr.json?.students.some((s) => s.id === "user_amara"), gr.json?.lessons.some((l) => l.id === "lesson_1"), gr.json?.submissions.some((s) => s.deliverableId === "del_journal" && s.grade === "7")]);
  check("grading: class list is id + name only", true, gr.json?.students.every((s) => Object.keys(s).join() === "id,name"));
  check("grading: student -> 403", 403, await code(student, "GET", "/api/grading"));

  // AI instructions are written on the AIDA page; the Lesson Editor's save leaves them alone.
  // Export as MD: the student's own answers, never the AI instructions.
  const put = await req(admin, "PUT", "/api/aida/admin", { lesson: { id: "lesson_1", aiInstructions: "Coach me on problem discovery. SMOKE-AI-1" } });
  check("admin saves AI instructions on a lesson", [200, "Coach me on problem discovery. SMOKE-AI-1"], [put.status, put.json?.lesson?.aiInstructions]);
  const l1 = (await req(admin, "GET", "/api/lessons/lesson_1")).json;
  const viaEditor = await req(admin, "PUT", "/api/lessons/lesson_1", { ...l1, aiInstructions: "overwritten by the editor" });
  check("a Lesson Editor save keeps the AI instructions", "Coach me on problem discovery. SMOKE-AI-1", viaEditor.json?.aiInstructions);
  check("AI instructions are not in the student's lesson data", [false, false], [
    (await req(student, "GET", "/api/lessons/view")).json.lessons.some((l) => "aiInstructions" in l),
    "aiInstructions" in (await req(student, "GET", "/api/lessons/lesson_1")).json,
  ]);
  await req(student, "PUT", "/api/submissions", { lessonId: "lesson_1", deliverableId: "del_worksheet", payload: { columns: ["Who is affected", "How often", "Evidence"], rowLabels: [], rows: [["Commuters", "Daily | twice", "Survey"], ["", "", ""]] } });
  const one = await fetch(`${BASE}/api/lessons/export?lesson=lesson_1`, { headers: { Cookie: student } });
  const oneText = await one.text();
  check("export one lesson -> markdown download", [200, true, true], [one.status, (one.headers.get("content-type") || "").startsWith("text/markdown"), /attachment; filename="EIB-lesson-1-problem-identification\.md"/.test(one.headers.get("content-disposition") || "")]);
  check("export: the student's answers, without the AI instructions", [true, false], [oneText.includes("#### Problem Journal Entry") && oneText.includes("my entry"), oneText.includes("SMOKE-AI-1")]);
  check("export: table answer as a markdown table, blank rows dropped, pipes escaped", true, oneText.includes("| Who is affected | How often | Evidence |") && oneText.includes("| Commuters | Daily \\| twice | Survey |") && !oneText.includes("|  |  |  |"));
  check("export: one lesson only", false, oneText.includes("Customer Discovery"));
  const allMd = await (await fetch(`${BASE}/api/lessons/export`, { headers: { Cookie: student } })).text();
  check("export all: every lesson in order, unanswered marked", true, allMd.indexOf("## Lesson 1: Problem Identification") < allMd.indexOf("## Lesson 2: Customer Discovery") && allMd.includes("_Not completed yet._") && /- \[[x ]\] Interviewed at least 3 people/.test(allMd));
  const staffMd = await (await fetch(`${BASE}/api/lessons/export?lesson=lesson_1`, { headers: { Cookie: leader } })).text();
  check("export for staff: the tasks, no student's answers, no AI instructions", [true, false, false], [staffMd.includes("#### Problem Journal Entry"), staffMd.includes("my entry"), staffMd.includes("SMOKE-AI-1")]);
  check("export: unknown lesson -> 404, stranger -> 401", [404, 401], [await code(student, "GET", "/api/lessons/export?lesson=nope"), await code(stranger, "GET", "/api/lessons/export")]);
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
  // seats: lesson 1 (Yes Mentor) holds one, lesson 99 (Mentor x2) holds two, lesson 3 (No Mentor) none
  const oneSeat = await req(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "1", assign: true });
  check("assign lesson 1 (one seat, Trent's) -> 409 naming Trent", [409, true], [oneSeat.status, /Trent/.test(oneSeat.json?.error || "")]);
  check("assign lesson 3 (No Mentor) -> 409", 409, await code(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "3", assign: true }));
  const a = await req(leader, "POST", `/api/mentors/${mentorId}/assign`, { lessonNumber: "99", assign: true });
  check("assign free lesson 99 -> 200", true, a.status === 200 && a.json.assignedLessons.some((x) => x.lessonNumber === "99"));
  const third = await req(leader, "POST", "/api/mentors", { name: "Third Wheel" });
  check("second mentor on lesson 99 (two seats) -> 200", 200, await code(leader, "POST", `/api/mentors/${third.json?.id}/assign`, { lessonNumber: "99", assign: true }));
  const fourth = await req(leader, "POST", "/api/mentors", { name: "Fourth Wheel" });
  const tooMany = await req(leader, "POST", `/api/mentors/${fourth.json?.id}/assign`, { lessonNumber: "99", assign: true });
  check("a third mentor on lesson 99 -> 409 naming both", [409, true], [tooMany.status, /Smoke Mentor.*Third Wheel/.test(tooMany.json?.error || "")]);
  const l99 = (await req(student, "GET", "/api/lessons/view")).json?.lessons.find((l) => l.number === "99");
  check("view: lesson 99 lists both mentors, first one still in `mentor`", ["Smoke Mentor", "Third Wheel", "Smoke Mentor"], [l99?.mentors?.[0]?.name, l99?.mentors?.[1]?.name, l99?.mentor?.name]);
  check("view: no contacts on either", true, (l99?.mentors || []).every((m) => !("contacts" in m)));
  check("unassign the second mentor from lesson 99 -> 200", 200, await code(leader, "POST", `/api/mentors/${third.json?.id}/assign`, { lessonNumber: "99", assign: false }));
  await req(admin, "DELETE", `/api/mentors/${third.json?.id}`);
  await req(admin, "DELETE", `/api/mentors/${fourth.json?.id}`);
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
  check("status: one-click sign-up, so no questions, and its title", [0, "Sign up for EIB"], [st.json?.form.length, st.json?.title]);
  check("status: previewer flag only for the super admin", [true, false, false], [(await req(admin, "GET", "/api/apply/status")).json?.previewer, (await req(leader, "GET", "/api/apply/status")).json?.previewer, st.json?.previewer]);
  // unfinished application: saved as they type, visible to the manager, restored on return
  check("draft without sign-in -> 401", 401, await code(null, "POST", "/api/apply/draft", { answers: [] }));
  check("applicant saves a draft -> 200", 200, await code(applicant, "POST", "/api/apply/draft", { answers: [{ questionId: "q_intro", answer: "Half done" }] }));
  const drafts = await req(leader, "GET", "/api/applications/drafts");
  check("leader sees the unfinished application", ["Half done"], (drafts.json || []).filter((d) => d.email === "smoke.applicant@tfs.ca").map((d) => d.answers[0]?.answer));
  check("student GET drafts -> 403", 403, await code(student, "GET", "/api/applications/drafts"));
  check("status returns the draft to the applicant", "Half done", (await req(applicant, "GET", "/api/apply/status")).json?.draft?.answers?.[0]?.answer);
  await Promise.all([1, 2, 3, 4].map((i) => req(applicant, "POST", "/api/apply/draft", { answers: [{ questionId: "q_intro", answer: `Half done ${i}` }] })));
  check("four saves at once -> still one draft row", 1, (await req(leader, "GET", "/api/applications/drafts")).json.filter((d) => d.email === "smoke.applicant@tfs.ca").length);
  const ok = await req(applicant, "POST", "/api/apply", GOOD({ q_problem: words(250) }));
  check("one click -> 201, straight into the class", [201, "class"], [ok.status, ok.json?.placed]);
  appId = ok.json?.id;
  check("second application same email -> 409", 409, await code(applicant, "POST", "/api/apply", GOOD()));
  const st2 = await req(applicant, "GET", "/api/apply/status");
  check("status: alreadyApplied, and told at once they are in the class", [true, "approved", null], [st2.json?.alreadyApplied, st2.json?.application?.decision, st2.json?.application?.waitlistPosition]);
  const list = await req(leader, "GET", "/api/applications");
  const mine = list.json?.find((a) => a.id === appId);
  check("manager list: in the class (first come, first served), name/email from sign-in, no answers", ["approved", true, "Smoke Applicant", "smoke.applicant@tfs.ca", 0], [mine?.status, mine?.fcfs, mine?.name, mine?.email, mine?.answers.length]);
  check("status: seats are counted for anyone looking at the page", [23, 8, true], (({ seats }) => [seats?.cap, seats?.waitlistSpots, seats?.seatsLeft > 0])((await req(stranger, "GET", "/api/apply/status")).json));
  check("student lists applications -> 403", 403, await code(student, "GET", "/api/applications"));
}

/* ---- 9. seats, the waitlist, accounts ---- */
{
  const after = await req(admin, "GET", "/api/applications/drafts");
  check("draft gone once submitted", false, (after.json || []).some((d) => d.email === "smoke.applicant@tfs.ca"));
  // super admin submits an unfinished application on the applicant's behalf
  const half = stranger + "; " + (await applicantSession("Half Way", "half.way@tfs.ca")).cookie;
  await req(half, "POST", "/api/apply/draft", { answers: [{ questionId: "q_problem", answer: "Only this much." }] });
  const draftRow = (await req(admin, "GET", "/api/applications/drafts")).json.find((d) => d.email === "half.way@tfs.ca");
  check("leader cannot submit for them -> 403", 403, await code(leader, "POST", `/api/applications/drafts/${draftRow?.id}/submit`));
  const forced = await req(admin, "POST", `/api/applications/drafts/${draftRow?.id}/submit`);
  check("admin submits for them -> 201, seated like any sign-up, with their answer", [201, "approved", "Only this much."], [forced.status, forced.json?.status, forced.json?.answers?.find((a) => a.questionId === "q_problem")?.answer]);
  check("their draft is gone", false, (await req(admin, "GET", "/api/applications/drafts")).json.some((d) => d.email === "half.way@tfs.ca"));
  check("they now appear in applications", true, (await req(leader, "GET", "/api/applications")).json.some((a) => a.email === "half.way@tfs.ca"));
  check("submit again -> 404 (draft gone)", 404, await code(admin, "POST", `/api/applications/drafts/${draftRow?.id}/submit`));
  check("their status page says applied", true, (await req(half, "GET", "/api/apply/status")).json?.alreadyApplied);
  check("clean reset of the forced application", 200, await code(admin, "DELETE", `/api/applications/${forced.json?.id}`));
}

head("first come, first served");
{
  const S = "/api/settings";
  const users = async () => (await req(admin, "GET", "/api/users?role=student")).json;
  const acct = async (email = "smoke.applicant@tfs.ca") => { const u = (await users()).find((x) => x.email === email); return u ? (u.suspended ? "suspended" : "active") : "none"; };
  const mine = async (cookie) => (await req(cookie, "GET", "/api/apply/status")).json;
  const apps = async () => (await req(admin, "GET", "/api/applications")).json;
  const idOf = async (email) => (await apps()).find((a) => a.email === email)?.id;
  const signUp = async (name, email) => { const cookie = stranger + "; " + (await applicantSession(name, email)).cookie; return { cookie, res: await req(cookie, "POST", "/api/apply", GOOD()) }; };
  const outbox = () => { try { return fs.readFileSync("data/outbox.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

  // the sign-up made under "applying" took a free seat
  check("signed up with a seat free: account active, sign-up carries the student id", ["active", true], [await acct(), Boolean((await req(leader, "GET", `/api/applications/${appId}`)).json?.studentId)]);
  check("the old release step is gone -> 405", 405, await code(admin, "POST", "/api/applications/release", {}));
  const newStudent = await login("smoke.applicant@tfs.ca");
  check("leader cannot press welcome -> 403", 403, await code(leader, "POST", "/api/welcome", {}));
  check("new student skips the old welcome page: lessons open, /welcome sends them on", [200, "/lessons"], [await code(newStudent, "GET", "/lessons"), new URL((await fetch(`${BASE}/welcome`, { headers: { Cookie: newStudent }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname]);

  // the class on hold: seats are kept, lessons stay closed until "Start class"
  check("a database never asked counts as started", true, (await req(leader, "GET", S)).json?.classStarted);
  check("leader cannot put the class on hold -> 403", 403, await code(leader, "PATCH", S, { classStarted: false }));
  check("settings PATCH with nothing in it -> 400", 400, await code(admin, "PATCH", S, {}));
  check("admin puts the class on hold", false, (await req(admin, "PATCH", S, { classStarted: false })).json?.classStarted);
  check("on hold: the student gets the holding page, the view API answers 403", [true, 403], [(await req(newStudent, "GET", "/lessons")).text.includes("Your seat is saved"), await code(newStudent, "GET", "/api/lessons/view")]);
  check("on hold: the sign-up page knows class has not started; staff still open lessons", [false, 200], [(await mine(applicant)).classStarted, await code(leader, "GET", "/api/lessons/view")]);
  check("start class: lessons open for the student", [true, 200], [(await req(admin, "PATCH", S, { classStarted: true })).json?.classStarted, await code(newStudent, "GET", "/api/lessons/view")]);

  // fill the class, then the waitlist
  const seatedNow = (await apps()).filter((a) => a.status === "approved").length;
  check("waitlist spots: default 8; -1 -> 400", [8, 400], [(await req(leader, "GET", S)).json?.waitlistSpots, await code(admin, "PATCH", S, { waitlistSpots: -1 })]);
  await req(admin, "PATCH", S, { classSizeCap: seatedNow, waitlistSpots: 2 });
  const fullClass = (await mine(stranger)).seats;
  check("class full: no seats, 2 waitlist spots, sign-up still open", [0, 2, false], [fullClass?.seatsLeft, fullClass?.waitlistLeft, fullClass?.full]);
  const w1 = await signUp("Wait One", "wait.one@tfs.ca");
  check("next sign-up joins the waitlist as number 1, with no account", [201, "waitlist", 1, "none"], [w1.res.status, w1.res.json?.placed, w1.res.json?.waitlistPosition, await acct("wait.one@tfs.ca")]);
  const w2 = await signUp("Wait Two", "wait.two@tfs.ca");
  const w2view = await mine(w2.cookie);
  check("the one after is told: on the waitlist, number 2 of 2", ["waitlist", 2, 2], [w2view.application?.decision, w2view.application?.waitlistPosition, w2view.seats?.waitlistSpots]);
  const refused = await signUp("Wait Three", "wait.three@tfs.ca");
  check("class and waitlist full: the page says so, a third sign-up -> 409, no row kept", [true, 409, false], [(await mine(stranger)).seats?.full, refused.res.status, (await apps()).some((a) => a.email === "wait.three@tfs.ca")]);
  check("leader cannot give a seat -> 403", 403, await code(leader, "PATCH", `/api/applications/${await idOf("wait.two@tfs.ca")}`, { status: "approved" }));

  // a seat frees up: the first in line moves in and is emailed
  check("leader clean-resets -> 403", 403, await code(leader, "DELETE", `/api/applications/${appId}`));
  const del = await req(admin, "DELETE", `/api/applications/${appId}`);
  check("admin removes a student: sign-up and account gone", [200, 1, 1, 404, "none"], [del.status, del.json?.removed?.application, del.json?.removed?.account, await code(leader, "GET", `/api/applications/${appId}`), await acct()]);
  check("the free seat goes to number 1: in the class, account made, emailed", ["wait.one@tfs.ca", "approved", "active", true], [del.json?.removed?.promoted?.[0]?.email, (await mine(w1.cookie)).application?.decision, await acct("wait.one@tfs.ca"), outbox().some((m) => m.to === "wait.one@tfs.ca" && m.subject.includes("seat opened"))]);
  check("the person behind moves up to number 1", 1, (await mine(w2.cookie)).application?.waitlistPosition);
  const grown = await req(admin, "PATCH", S, { classSizeCap: seatedNow + 1 });
  check("a bigger class seats the next in line", ["wait.two@tfs.ca", "approved", 0], [grown.json?.promoted?.[0]?.email, (await mine(w2.cookie)).application?.decision, (await mine(stranger)).seats?.waitlisted]);

  // the super admin can seat someone by hand, past the class size
  const w4 = await signUp("Wait Four", "wait.four@tfs.ca");
  const w4id = await idOf("wait.four@tfs.ca");
  check("class full again: the next sign-up waits", "waitlist", w4.res.json?.placed);
  check("unknown status -> 400", 400, await code(admin, "PATCH", `/api/applications/${w4id}`, { status: "maybe" }));
  const seatedByHand = await req(admin, "PATCH", `/api/applications/${w4id}`, { status: "approved" });
  check("super admin gives a seat: in the class with an account, past the class size", ["approved", "active", true], [seatedByHand.json?.status, await acct("wait.four@tfs.ca"), (await apps()).filter((a) => a.status === "approved").length > seatedNow + 1]);
  check("moved out of the class -> account suspended", [200, "suspended"], [await code(admin, "PATCH", `/api/applications/${w4id}`, { status: "denied" }), await acct("wait.four@tfs.ca")]);

  // put everything back
  for (const email of ["wait.one@tfs.ca", "wait.two@tfs.ca", "wait.four@tfs.ca"]) await req(admin, "DELETE", `/api/applications/${await idOf(email)}`);
  await req(admin, "PATCH", S, { classSizeCap: 23, waitlistSpots: 8 });
  const again = await req(applicant, "POST", "/api/apply", GOOD());
  check("same email can sign up again, and gets a seat", [201, "class"], [again.status, again.json?.placed]);
  check("clean reset of that sign-up, and of one already gone -> 200, 404", [200, 404], [await code(admin, "DELETE", `/api/applications/${again.json?.id}`), await code(admin, "DELETE", `/api/applications/${appId}`)]);
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
  // the signing form is editable: its wording, the relationship options, extra questions
  const formEdit = await req(admin, "PUT", "/api/agreement", {
    wording: { readStatement: "SMOKE read statement", studentSignatureLabel: "", parentEmailHelp: "" },
    relationships: ["Mother", "Father", " Aunt ", "Aunt", ""],
    questions: [{ id: "aq_phone", type: "short", label: "Guardian phone", required: true, askedOf: "guardian" }, { type: "choice", label: "T-shirt size", required: false, options: ["S", "M"], askedOf: "nonsense" }],
  });
  const sizeId = formEdit.json?.questions?.[1]?.id;
  check("signing form wording: saved; an empty label goes back to the original; an empty helper line is hidden", ["SMOKE read statement", "Student signature", ""], [formEdit.json?.wording?.readStatement, formEdit.json?.wording?.studentSignatureLabel, formEdit.json?.wording?.parentEmailHelp]);
  check("signing form: relationship options trimmed, no blanks or repeats", ["Mother", "Father", "Aunt"], formEdit.json?.relationships);
  check("signing form: extra questions saved with an id and who answers", ["aq_phone", "guardian", true, "student"], [formEdit.json?.questions?.[0]?.id, formEdit.json?.questions?.[0]?.askedOf, Boolean(sizeId), formEdit.json?.questions?.[1]?.askedOf]);
  check("leader cannot edit the signing form -> 403", 403, await code(leader, "PUT", "/api/agreement", { questions: [] }));
  const asStudent = (await req(student, "GET", "/api/agreement")).json;
  check("the student is given the form's wording, options and questions", ["SMOKE read statement", 3, 2], [asStudent?.wording?.readStatement, asStudent?.relationships?.length, asStudent?.questions?.length]);
  const good = { readConfirmed: true, studentSignature: "Amara Chen", parentSignature: "Mei Chen", parentEmail: "mei.chen@example.com", parentRelationship: "Mother", parentConfirmed: true, answers: { aq_phone: "416 555 0100" } };
  check("sign without a required extra answer -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, answers: {} }));
  check("sign with a relationship that is no longer an option -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, parentRelationship: "Legal guardian" }));
  check("sign with a choice that is not one of the options -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, answers: { ...good.answers, [sizeId]: "XL" } }));
  check("sign without parent confirm -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, parentConfirmed: false }));
  check("sign with a bad signature -> 400", 400, await code(student, "POST", "/api/agreement/accept", { ...good, studentSignature: "123" }));
  check("leader cannot sign -> 403", 403, await code(leader, "POST", "/api/agreement/accept", good));
  const outbox = () => { try { return fs.readFileSync("data/outbox.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  const tokenOf = (entry) => (entry?.text.match(/token=([a-f0-9]{64})/) || [])[1];
  const before = outbox().length;
  const signed = await req(student, "POST", "/api/agreement/accept", good);
  check("student submits -> 200, pending, guardian emailed", [200, "pending", "Mei Chen", "2026-27", true], [signed.status, signed.json?.agreement?.status, signed.json?.agreement?.parentName, signed.json?.agreement?.versionLabel, outbox().length === before + 1]);
  check("the record keeps the extra answers (the optional one left empty is not stored)", [1, "aq_phone", "guardian", "416 555 0100"], [signed.json?.agreement?.answers?.length, signed.json?.agreement?.answers?.[0]?.questionId, signed.json?.agreement?.answers?.[0]?.askedOf, signed.json?.agreement?.answers?.[0]?.answer]);
  const formReset = await req(admin, "PUT", "/api/agreement", { wording: { readStatement: "" }, relationships: [], questions: [] });
  check("signing form put back: original statement, the four relationships, no extra questions", [true, 4, 0], [formReset.json?.wording?.readStatement.startsWith("I have read and understood"), formReset.json?.relationships?.length, formReset.json?.questions?.length]);
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
  check("old link now invalid (replaced)", true, (await fetch(`${BASE}/api/agreement/confirm?token=${tokenOf(mail)}`, { redirect: "manual" })).headers.get("location")?.includes("state=invalid"));
  // the super admin corrects a mistyped guardian address
  const resentToken = tokenOf(outbox().slice(-1)[0]);
  check("student cannot change the guardian email -> 403", 403, await code(student, "PUT", "/api/agreement/guardian-email", { userId: amaraId, parentEmail: "x@example.com" }));
  check("guardian email: invalid address -> 400", 400, await code(admin, "PUT", "/api/agreement/guardian-email", { userId: amaraId, parentEmail: "not-an-email" }));
  check("guardian email: same address -> 400", 400, await code(admin, "PUT", "/api/agreement/guardian-email", { userId: amaraId, parentEmail: "mei.chen@example.com" }));
  const changed = await req(admin, "PUT", "/api/agreement/guardian-email", { userId: amaraId, parentEmail: "Mei.Correct@example.com" });
  check("guardian email changed -> 200, stored, new email to the new address", [200, "mei.correct@example.com", "pending", before + 3, "mei.correct@example.com"], [changed.status, changed.json?.agreement?.parentEmail, changed.json?.agreement?.status, outbox().length, outbox().slice(-1)[0]?.to]);
  check("old address kept in the history, no token exposed", ["mei.chen@example.com", false], [changed.json?.agreement?.parentEmailHistory?.[0]?.email, "confirmation" in (changed.json?.agreement || {})]);
  check("link sent to the old address no longer works", true, (await fetch(`${BASE}/api/agreement/confirm?token=${resentToken}`, { redirect: "manual" })).headers.get("location")?.includes("state=invalid"));
  const fresh = tokenOf(outbox().slice(-1)[0]);
  const ok = await fetch(`${BASE}/api/agreement/confirm?token=${fresh}`, { redirect: "manual" });
  check("guardian clicks the fresh link -> ok page", true, ok.headers.get("location")?.includes("state=ok"));
  check("same link again -> used page", true, (await fetch(`${BASE}/api/agreement/confirm?token=${fresh}`, { redirect: "manual" })).headers.get("location")?.includes("state=used"));
  check("confirmed page renders for the guardian", true, (await req(null, "GET", "/agreement/confirmed?state=ok&student=Amara")).text.includes("Thank you"));
  check("student view open again", 200, await code(student, "GET", "/api/lessons/view"));
  const row = (await req(admin, "GET", "/api/users?role=student")).json.find((u) => u.email === "amara.chen@tfs.ca");
  check("admin sees signed + confirmation time + guardian", ["signed", true, "Mother"], [row?.agreement?.status, Boolean(row?.agreement?.confirmedAt), row?.agreement?.parentRelationship]);
  check("resend after signed -> 409", 409, await code(student, "POST", "/api/agreement/resend", {}));
  check("guardian email change after signed -> 409", 409, await code(admin, "PUT", "/api/agreement/guardian-email", { userId: amaraId, parentEmail: "late@example.com" }));
  // a parent or guardian signs their child up on their own
  {
    const P = "/api/apply/parent";
    const parent = { parentName: "Pat Parent", parentEmail: "Pat.Parent@example.com", studentName: "Kid Parent", studentEmail: "Kid.Parent@tfs.ca" };
    const kidApp = async () => (await req(admin, "GET", "/api/applications")).json.find((a) => a.email === "kid.parent@tfs.ca");
    const kidUser = async () => (await req(admin, "GET", "/api/users?role=student")).json.find((u) => u.email === "kid.parent@tfs.ca");
    check("parent sign-up: student email off the school domain -> 400", 400, await code(null, "POST", P, { ...parent, studentEmail: "kid@gmail.com" }));
    check("parent sign-up: the student's email given as their own -> 400", 400, await code(null, "POST", P, { ...parent, parentEmail: "kid.parent@tfs.ca" }));
    check("parent sign-up: a student who is already signed up -> 409", 409, await code(null, "POST", P, { ...parent, studentEmail: "amara.chen@tfs.ca" }));
    const sentBefore = outbox().length;
    const asked = await req(null, "POST", P, parent);
    check("parent asks -> 201, one email with a link, no seat taken yet", [201, "p…@example.com", sentBefore + 1, "pat.parent@example.com", false], [asked.status, asked.json?.parentEmailMasked, outbox().length, outbox().at(-1)?.to, Boolean(await kidApp())]);
    check("asking again straight away -> 429", 429, await code(null, "POST", P, parent));
    const ptoken = tokenOf(outbox().at(-1));
    check("the agreement PDF: no sign-in -> 401, the parent's link -> 200", [401, 200], [(await fetch(`${BASE}/api/agreement/pdf`, { headers: { Cookie: stranger } })).status, (await fetch(`${BASE}/api/agreement/pdf?token=${ptoken}`, { headers: { Cookie: stranger } })).status]);
    const opened = await req(null, "GET", `/parent?token=${ptoken}`);
    const seated = await kidApp();
    check("opening the link takes the seat: the page says so, the sign-up names the parent, an account exists", [200, true, "approved", "Pat Parent", true], [opened.status, opened.text.includes("has a seat in EIB"), seated?.status, seated?.parent?.name, Boolean(await kidUser())]);
    check("the student is emailed that they were signed up", true, outbox().some((m) => m.to === "kid.parent@tfs.ca" && m.subject === "You have been signed up for EIB" && m.text.includes("Pat Parent")));
    check("opening the link twice makes no second sign-up", 1, (await req(null, "GET", `/parent?token=${ptoken}`), (await req(admin, "GET", "/api/applications")).json.filter((a) => a.email === "kid.parent@tfs.ca").length));
    const kid = await login("kid.parent@tfs.ca");
    check("until the agreement is signed the student has no lessons (page -> /onboarding, API 403)", ["/onboarding", 403], [new URL((await fetch(`${BASE}/lessons`, { headers: { Cookie: kid }, redirect: "manual" })).headers.get("location") || "/", BASE).pathname, await code(kid, "GET", "/api/lessons/view")]);
    const sign = (over = {}) => req(null, "POST", `${P}/sign`, { token: ptoken, readConfirmed: true, parentSignature: "Pat Parent", parentRelationship: "Father", parentConfirmed: true, ...over });
    check("parent signs without agreeing -> 400; with a bad link -> 404", [400, 404], [(await sign({ parentConfirmed: false })).status, (await sign({ token: "0".repeat(64) })).status]);
    const mailsBefore = outbox().length;
    const psigned = await sign();
    check("parent signs alone -> the agreement is signed at once, with no confirmation email", [200, "signed", "guardian", "pat.parent@example.com", mailsBefore], [psigned.status, psigned.json?.agreement?.status, psigned.json?.agreement?.signedBy, psigned.json?.agreement?.parentEmail, outbox().length]);
    check("the student's lessons open without the student signing", 200, await code(kid, "GET", "/api/lessons/view"));

    // payment: a link to a page EIB already has, then the super admin's tick
    check("payment link must be a web address -> 400", 400, await code(admin, "PUT", "/api/agreement", { payment: { url: "javascript:alert(1)" } }));
    const pay = await req(admin, "PUT", "/api/agreement", { payment: { url: "https://pay.example.com/eib", note: "SMOKE pay note" } });
    check("payment link and note saved; the button keeps its default words", ["https://pay.example.com/eib", "SMOKE pay note", "Pay the program fee"], [pay.json?.payment?.url, pay.json?.payment?.note, pay.json?.payment?.label]);
    const after = await req(null, "GET", `/parent?token=${ptoken}`);
    check("the parent's page: agreement signed, then how to pay", [true, true, true], [after.text.includes("The Student Agreement is signed"), after.text.includes("SMOKE pay note"), after.text.includes("https://pay.example.com/eib")]);
    check("the student is given the payment step too, not yet paid", ["https://pay.example.com/eib", false], (({ json }) => [json?.payment?.url, json?.paid])(await req(kid, "GET", "/api/agreement")));
    check("leader cannot tick the fee -> 403", 403, await code(leader, "PATCH", `/api/applications/${seated?.id}`, { paid: true }));
    check("admin ticks the fee as paid: stored, and both pages say so", [true, true, true], [Boolean((await req(admin, "PATCH", `/api/applications/${seated?.id}`, { paid: true })).json?.paidAt), (await req(kid, "GET", "/api/agreement")).json?.paid, (await req(null, "GET", `/parent?token=${ptoken}`)).text.includes("has been received")]);
    check("admin unticks it", null, (await req(admin, "PATCH", `/api/applications/${seated?.id}`, { paid: false })).json?.paidAt);
    check("removing the student ends the parent's link", [200, true], [await code(admin, "DELETE", `/api/applications/${seated?.id}`), (await req(null, "GET", `/parent?token=${ptoken}`)).text.includes("not recognised")]);
    await req(admin, "PUT", "/api/agreement", { payment: { url: "", note: "" } });
  }
  const up2 = await upload(admin);
  check("replacing the PDF -> version 2 and the student must sign again", [2, 403], [up2.json?.version, await code(student, "GET", "/api/lessons/view")]);
  check("switching required off reopens lessons", [200, 200], [await code(admin, "PUT", "/api/agreement", { required: false }), await code(student, "GET", "/api/lessons/view")]);
  check("leader cannot change the settings -> 403", 403, await code(leader, "PUT", "/api/agreement", { required: true }));
  check("admin removes the PDF", 200, await code(admin, "DELETE", "/api/agreement/pdf"));
  await req(admin, "PUT", "/api/agreement", { required: true });
}

/* ---- the test student account is gone ---- */
head("no test account");
{
  check("the test account route no longer exists -> 404", [404, 404], [await code(admin, "GET", "/api/test-account"), await code(admin, "POST", "/api/test-account", { email: "tester@tfs.ca" })]);
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

/* ---- AIDA: the AI cofounder ---- */
head("AIDA");
{
  const A = "/api/aida/admin";
  const chat = (cookie, lessonId, message) => req(cookie, "POST", "/api/aida/chat", { lessonId, message });
  check("AIDA pages: admin 200; admin API: student and leader -> 403", [200, 200, 403, 403], [await code(admin, "GET", "/aida"), await code(admin, "GET", "/aida/chat"), await code(student, "GET", A), await code(leader, "GET", A)]);
  const first = (await req(admin, "GET", A)).json;
  check("AIDA starts off, with every lesson's instructions", ["off", true, true], [first?.settings.mode, first?.lessons.some((l) => l.id === "lesson_1" && l.aiInstructions.includes("SMOKE-AI-1")), first?.lessons.length >= 4]);
  check("off: no Ask AIDA for the student, chat refused", [false, 403], [(await req(student, "GET", "/api/lessons/view")).json.aida, (await chat(student, "lesson_2", "hello")).status]);

  // AIDA reads everything: every lesson's instructions, and all of the student's work
  await req(admin, "PUT", A, { lesson: { id: "lesson_2", aiInstructions: "SMOKE-AI-2 push on interview evidence {{deliverable:del_journal|old marker}}" } });
  const asAmara = (await req(admin, "GET", `${A}?preview=1&lesson=lesson_2&student=user_amara`)).json;
  check("what AIDA sees: every lesson's instructions and tasks, the same for all", [true, true, true, false], [asAmara.shared.includes("SMOKE-AI-1"), asAmara.shared.includes("SMOKE-AI-2"), asAmara.shared.includes("Paste a link to your pitch deck"), asAmara.shared.includes("{{deliverable")]);
  check("what AIDA sees: all of the student's work, the lesson they are on, no name", [true, true, true, false], [
    asAmara.context.includes("my entry") && asAmara.context.includes("Commuters"),
    asAmara.context.includes("The student opened you from Lesson 2: Customer Discovery"),
    asAmara.context.includes("### 4A: Pitch Deck"),
    /Amara|amara\.chen/.test(asAmara.context + asAmara.shared),
  ]);
  check("the shared part holds no student's answers", false, asAmara.shared.includes("my entry"));
  check("AIDA is told each deliverable's short name and id, and how to pull one into the chat", [true, true, true], [asAmara.shared.includes("- 1A: Problem Journal Entry (id: del_journal)"), asAmara.shared.includes("- 1B: Problem Validation Worksheet (id: del_worksheet)"), asAmara.shared.includes("[[show:ID]]")]);
  const blank = (await req(admin, "GET", `${A}?preview=1&lesson=lesson_2`)).json;
  check("what AIDA sees with no student: no answers", [false, false, true], [blank.context.includes("my entry"), blank.context.includes("Commuters"), blank.context.includes("_Not completed yet._")]);

  await req(admin, "PUT", A, { settings: { general: "SMOKE-GENERAL house rule" } });
  check("general context reaches every lesson", true, (await req(admin, "GET", `${A}?preview=1&lesson=lesson_1`)).json.shared.includes("SMOKE-GENERAL house rule"));

  const trial = await req(admin, "POST", A, { lessonId: "lesson_2", studentId: "user_amara", messages: [{ role: "user", content: "SMOKE-TEST-TAB" }] });
  const trialEdit = (await req(admin, "POST", A, { preview: true, lessonId: "lesson_2", studentId: "user_amara", edits: { "lesson_1:del_journal": { text: "SMOKE-TRIAL-EDIT" } } })).json;
  check("Chat with AIDA: a trial edit reaches AIDA and is not saved to the student", [true, false, false], [
    trialEdit.context.includes("SMOKE-TRIAL-EDIT"),
    trialEdit.context.includes("my entry"),
    (await req(admin, "GET", "/api/submissions?studentId=user_amara")).json.some((s) => JSON.stringify(s.payload).includes("SMOKE-TRIAL-EDIT")),
  ]);
  const told = await req(admin, "POST", A, { lessonId: "lesson_2", studentId: "user_amara", edits: { "lesson_1:del_journal": { text: "SMOKE-TRIAL-EDIT" } }, changed: ["lesson_1:del_journal", "nope:nope"], messages: [{ role: "user", content: "I changed 1A" }] });
  check("Chat with AIDA: AIDA is told which answer changed", true, told.text.includes("Changed answers received with this message: 1."));
  check("Chat with AIDA: admin gets a reply; a student cannot use it", [200, true, 403], [trial.status, trial.text.includes("SMOKE-TEST-TAB") && trial.text.includes("Lesson 2"), (await req(student, "POST", A, { lessonId: "lesson_2", messages: [{ role: "user", content: "x" }] })).status]);

  check("the old test-account-only mode is ignored: AIDA stays off", ["off", false], [(await req(admin, "PUT", A, { settings: { mode: "test" } })).json?.settings.mode, (await req(student, "GET", "/api/lessons/view")).json.aida]);
  await req(admin, "PUT", A, { settings: { mode: "on" } });
  check("on: the student gets Ask AIDA; leaders and strangers cannot chat", [true, 403, 401], [(await req(student, "GET", "/api/lessons/view")).json.aida, (await chat(leader, "lesson_2", "hi")).status, (await chat(stranger, "lesson_2", "hi")).status]);
  const r1 = await chat(student, "lesson_2", "SMOKE-HELLO what is weak here?");
  check("student chats: a reply about that lesson", [200, true], [r1.status, r1.text.includes("SMOKE-HELLO") && r1.text.includes("Lesson 2")]);
  const convo = (await req(student, "GET", "/api/aida/chat?lesson=lesson_2")).json;
  check("the conversation is kept: question, answer, one fewer left today", [2, "SMOKE-HELLO what is weak here?", 59], [convo.messages.length, convo.messages[0]?.content, convo.remaining]);
  check("AIDA can pull a deliverable into the chat", true, (await chat(student, "lesson_3", "show me my work")).text.includes("[[show:del_journal]]"));
  await req(student, "PUT", "/api/submissions", { lessonId: "lesson_1", deliverableId: "del_journal", payload: { text: "SMOKE-CARD-EDIT new journal answer" } });
  await chat(student, "lesson_3", "I changed it");
  check("an answer edited mid-chat reaches AIDA as a change, and the chat shows only what was typed", "I changed it", (await req(student, "GET", "/api/aida/chat?lesson=lesson_3")).json.messages[2]?.content);
  // A deliverable AIDA writes out: marked in the reply, read back as the answer its "Add to" button puts in
  const { splitReply, draftPayload } = await import("../src/lib/aida/draft.js");
  const drafted = splitReply((await chat(student, "lesson_3", "draft it")).text).find((p) => p.draft)?.draft;
  check("AIDA is told how to write a deliverable out, and a written one is read back as the answer", [true, "del_journal", true, { text: "SANDBOX-DRAFT one" + String.fromCharCode(10) + "SANDBOX-DRAFT two" }], [asAmara.shared.includes("[[draft:ID]]"), drafted?.id, drafted?.done, draftPayload({ type: "text" }, drafted?.body)]);
  check("a table AIDA writes out fills the right rows", [["", ""], ["bus late", "nervous"]], draftPayload({ type: "table", columns: ["What happens", "How they feel"], rowLabels: ["Starting State", "Trigger"] }, "Trigger | bus late | nervous")?.rows);
  check("another lesson is another conversation", 0, (await req(student, "GET", "/api/aida/chat?lesson=lesson_1")).json.messages.length);
  check("empty, too long, unknown lesson -> 400, 400, 404", [400, 400, 404], [(await chat(student, "lesson_2", "  ")).status, (await chat(student, "lesson_2", "x".repeat(2001))).status, (await chat(student, "nope", "hi")).status]);
  // opening hours (Toronto time): closed on every day but today, then open all of today
  const todayIs = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto", weekday: "long" }));
  const hrs = (await req(admin, "PUT", A, { settings: { hours: { enabled: true, days: [(todayIs + 1) % 7], start: "16:00", end: "17:30" } } })).json?.settings.hours;
  const shut = await chat(student, "lesson_2", "are you open?");
  check("set hours, another day: chat refused with the hours, the old chat still readable", [true, 403, true, true, 2], [hrs?.enabled, shut.status, /4:00 PM to 5:30 PM/.test(shut.json?.error || ""), /closed right now/.test((await req(student, "GET", "/api/aida/chat?lesson=lesson_2")).json.closed), (await req(student, "GET", "/api/aida/chat?lesson=lesson_2")).json.messages.length]);
  await req(admin, "PUT", A, { settings: { hours: { days: [todayIs], start: "00:00", end: "23:59" } } });
  check("set hours, today all day: open", ["", 200], [(await req(student, "GET", "/api/aida/chat?lesson=lesson_2")).json.closed, (await chat(student, "lesson_2", "open now?")).status]);
  check("an end time before the start is not saved", "23:59", (await req(admin, "PUT", A, { settings: { hours: { start: "18:00", end: "09:00" } } })).json?.settings.hours.end);
  await req(admin, "PUT", A, { settings: { hours: { enabled: false, days: [2], start: "16:00", end: "17:30" } } });
  await req(admin, "PUT", A, { settings: { dailyLimit: 1 } });
  check("daily limit reached -> 429", 429, (await chat(student, "lesson_2", "one more")).status);
  await req(admin, "PUT", A, { settings: { dailyLimit: 60 } });
  check("new chat clears the panel", [200, 0], [await code(student, "DELETE", "/api/aida/chat?lesson=lesson_2"), (await req(student, "GET", "/api/aida/chat?lesson=lesson_2")).json.messages.length]);
  const usage = (await req(admin, "GET", A)).json.usage;
  check("usage is counted (student messages + chat page messages)", 7, usage.today.messages);

  // AIDA Unlocked: the demo cofounder, super admin only, with the method kept in the database
  const U = "/api/aida/unlocked";
  check("AIDA Unlocked: page and API for the admin; student and leader -> 403", [200, 200, 403, 403], [await code(admin, "GET", "/aida-unlocked"), await code(admin, "GET", U), await code(student, "GET", U), await code(leader, "POST", U, { messages: [{ role: "user", content: "hi" }] })]);
  check("AIDA Unlocked: starts with no method loaded", 0, (await req(admin, "GET", U)).json.knowledge.words);
  const bare = await req(admin, "POST", U, { messages: [{ role: "user", content: "SMOKE-UNLOCKED" }] });
  check("AIDA Unlocked: answers without the method", [true, true], [bare.text.includes("Method loaded: none"), bare.text.includes("SMOKE-UNLOCKED")]);
  const loaded = await req(admin, "PUT", U, { knowledge: "one two three four five", name: "smoke.txt" });
  check("AIDA Unlocked: the method file is saved and described", [5, "smoke.txt", 5], [loaded.json?.knowledge.words, loaded.json?.knowledge.name, (await req(admin, "GET", U)).json.knowledge.words]);
  const withMethod = await req(admin, "POST", U, { messages: [{ role: "user", content: "hello" }, { role: "assistant", content: "[[searching]]hi" }, { role: "user", content: "please search" }] });
  check("AIDA Unlocked: reads the method and the whole chat; a search is marked and its sources listed", [true, true, true, true], [withMethod.text.includes("Method loaded: 5 words"), withMethod.text.includes("Messages so far: 3"), withMethod.text.includes("[[searching]]"), withMethod.text.includes("https://example.com/smoke")]);
  check("AIDA Unlocked: no message, or not text -> 400", [400, 400], [await code(admin, "POST", U, { messages: [] }), await code(admin, "PUT", U, { knowledge: 5 })]);
  check("AIDA Unlocked: its messages are counted in usage", 9, (await req(admin, "GET", A)).json.usage.today.messages);
  await req(admin, "PUT", U, { knowledge: "", name: "" });

  // One-time demo links: no account, first browser to press Start gets it, spent for everyone else
  const D = "/api/aida/demo-links";
  check("demo links: student and leader cannot make or list them", [403, 403], [await code(student, "GET", D), await code(leader, "POST", D, { label: "x" })]);
  const made = (await req(admin, "POST", D, { label: "SMOKE investor" })).json;
  const demo = `/api/demo/${made?.id}`;
  const hello = { messages: [{ role: "user", content: "SMOKE-DEMO" }] };
  check("demo link: made, listed as not opened", [true, "unused", "SMOKE investor"], [/^[A-Za-z0-9_-]{24}$/.test(made?.id || ""), made?.links[0]?.status, made?.links[0]?.label]);
  const landing = await req(null, "GET", `/demo/${made?.id}`);
  check("demo link: the page opens with no account, and opening it does not use it up", [200, true, "unused"], [landing.status, landing.text.includes("Start the demo"), (await req(admin, "GET", D)).json.links[0].status]);
  check("demo link: no chat before Start; a made-up link is refused", [410, 410, true], [await code(null, "POST", demo, hello), await code(null, "POST", "/api/demo/abcdefghijklmnopqrstuvwx", { start: true }), (await req(null, "GET", "/demo/abcdefghijklmnopqrstuvwx")).text.includes("not available")]);
  const started = await req(null, "POST", demo, { start: true });
  const visitor = cookieOf(started);
  check("demo link: Start claims it for that browser", [200, "active", 40, true], [started.status, started.json?.status, started.json?.left, /HttpOnly/i.test(started.setCookie.join(";"))]);
  check("demo link: spent for anyone else (second Start, chat without the cookie, the page)", [410, 410, true], [await code(null, "POST", demo, { start: true }), await code(null, "POST", demo, hello), (await req(null, "GET", `/demo/${made?.id}`)).text.includes("already been used")]);
  const said = await req(visitor, "POST", demo, hello);
  check("demo link: the visitor chats with AIDA Unlocked, and it is counted", [true, "open", 1], [said.text.includes("AIDA Unlocked here") && said.text.includes("SMOKE-DEMO"), (await req(admin, "GET", D)).json.links[0].status, (await req(admin, "GET", D)).json.links[0].messages]);
  check("demo link: the visitor cannot reach anything else", [403, 403], [await code(student, "GET", U), await code(student, "GET", D)]);
  check("demo link: deleted -> the visitor is cut off", [0, 410], [(await req(admin, "DELETE", `${D}?id=${made?.id}`)).json.links.length, await code(visitor, "POST", demo, hello)]);

  await req(admin, "PUT", A, { settings: { mode: "off", general: "" } });
  await req(admin, "PUT", A, { lesson: { id: "lesson_2", aiInstructions: "" } });
  check("switched off again: chat refused", 403, (await chat(student, "lesson_2", "hello")).status);
}

/* ---- graduation: the EIB Founder Micro-Credential ---- */
head("graduation and micro-credentials");
{
  const G = "/api/graduation";
  const outboxFile = path.join(process.cwd(), "data", "outbox.jsonl");
  const outbox = () => (fs.existsSync(outboxFile) ? fs.readFileSync(outboxFile, "utf8").split("\n").filter(Boolean).length : 0);
  const mailBefore = outbox();
  const page = async (id) => {
    const res = await fetch(`${BASE}/c/${id}`, { headers: { Cookie: stranger } });
    return { status: res.status, text: await res.text(), robots: res.headers.get("x-robots-tag") || "" };
  };
  const amara = (j) => j?.students.find((s) => s.id === "user_amara");
  const put = (d, payload) => req(student, "PUT", "/api/submissions", { lessonId: d.lessonId, deliverableId: d.id, payload });

  check("graduation: only the super admin reads it or releases", [403, 403, 401, 403, 403], [await code(leader, "GET", G), await code(student, "GET", G), await code(stranger, "GET", G), await code(leader, "POST", G, { action: "releaseAll" }), await code(student, "POST", G, { action: "release", studentId: "user_amara" })]);
  await req(admin, "PATCH", G, { hidden: [], storyDeliverableId: "", criteria: "" });
  const start = (await req(admin, "GET", G)).json;
  check("graduation: each student with their progress, nobody released", [true, true, false, null], [start.students.length > 0, start.deliverables.length > 1, amara(start)?.complete, amara(start)?.credential ?? null]);
  check("graduation: nobody has completed everything -> Release Credentials releases nobody; one unfinished student is refused", [[], 409, 404, 400], [(await req(admin, "POST", G, { action: "releaseAll" })).json.released, await code(admin, "POST", G, { action: "release", studentId: "user_amara" }), await code(admin, "POST", G, { action: "release", studentId: "user_jack" }), await code(admin, "POST", G, { action: "nope" })]);

  // The student fills every field of every deliverable (the last table is left one cell short first).
  const lessons = (await req(admin, "GET", "/api/lessons")).json.filter((l) => l.studentVisible);
  const dels = lessons.flatMap((l) => l.deliverables.map((d) => ({ ...d, lessonId: l.id })));
  const mark = (d) => `SMOKE-CRED-${d.id}`;
  const answer = (d) => {
    if (d.type === "text") return { text: mark(d) };
    if (d.type === "link") return { url: `https://example.com/${mark(d)}` };
    if (d.type === "checklist") return { items: d.checklistItems.map((label) => ({ label, checked: true })) };
    const columns = d.columns.length ? d.columns : ["Column 1", "Column 2"];
    const rows = d.rowLabels.length ? d.rowLabels.map(() => columns.map(() => mark(d))) : [columns.map(() => mark(d)), columns.map(() => "")];
    return { columns, rowLabels: d.rowLabels, rows };
  };
  for (const d of dels) await put(d, answer(d));
  const table = dels.find((d) => d.type === "table");
  const checklist = dels.find((d) => d.type === "checklist" && d.checklistItems.length > 1);
  const short = answer(table);
  short.rows[0][short.rows[0].length - 1] = " ";
  await put(table, short);
  await put(checklist, { items: checklist.checklistItems.map((label, i) => ({ label, checked: i > 0 })) });
  const nearly = amara((await req(admin, "GET", G)).json);
  check("complete = every field filled: a table one cell short and a checklist one box short do not count", [nearly.total - 2, false, [table.id, checklist.id].sort()], [nearly.done, nearly.complete, nearly.missing.map((m) => m.id).sort()]);
  await put(table, answer(table));
  await put(checklist, answer(checklist));
  check("every field filled -> complete", [true, 0], (({ complete, missing }) => [complete, missing.length])(amara((await req(admin, "GET", G)).json)));

  // What the page shows: a founder story, and one deliverable kept private.
  const story = dels.find((d) => d.type === "text");
  const secret = dels.find((d) => d.type === "link");
  const set = await req(admin, "PATCH", G, { storyDeliverableId: story.id, hidden: [secret.id], criteria: "SMOKE criteria: finished everything." });
  check("graduation settings are saved; student and leader cannot change them", [story.id, [secret.id], 403, 403, 400], [set.json?.settings.storyDeliverableId, set.json?.settings.hidden, await code(student, "PATCH", G, { hidden: [] }), await code(leader, "PATCH", G, { hidden: [] }), await code(admin, "PATCH", G, {})]);
  check("nothing is public before release", [null, null], [amara(set.json).credential, (await req(student, "GET", "/api/lessons/view")).json?.credential ?? null]);

  const rel = (await req(admin, "POST", G, { action: "releaseAll" })).json;
  const cred = amara(rel).credential;
  const id = cred?.id || "none";
  check("Release Credentials: the student who completed everything gets one, with an unguessable id", [true, true, "active"], [rel.released.includes("Amara Chen"), /^[A-Za-z0-9_-]{22}$/.test(id), cred?.status]);
  check("only students who completed everything got one", true, rel.students.every((s) => Boolean(s.credential) === s.complete));
  check("releasing emails nobody", mailBefore, outbox());

  const pub = await page(id);
  check("public page: opens with no account, marked noindex", [200, true, true], [pub.status, /noindex/.test(pub.robots), /<meta name="robots" content="noindex/.test(pub.text)]);
  check("public page: Verified, the student, title, issuer, cohort, criteria", [true, true, true, true, true, true], [pub.text.includes("Verified"), pub.text.includes("Amara Chen"), pub.text.includes("EIB Founder Micro-Credential"), pub.text.includes("EIB by Nemosyne LTD"), pub.text.includes(rel.cohort), pub.text.includes("SMOKE criteria: finished everything.")]);
  check("public page: the founder story and the deliverables, without the private one", [true, true, true, false], [pub.text.includes("Founder story"), pub.text.includes(mark(story)), pub.text.includes(mark(table)), pub.text.includes(mark(secret))]);
  check("public page: Add to LinkedIn", true, pub.text.includes("Add to LinkedIn") && pub.text.includes("linkedin.com/profile/add?startTask=CERTIFICATION_NAME"));
  check("a made-up or malformed link is not found", [404, 404, true], [(await page("abcdefghijklmnopqrstuv")).status, (await page("x")).status, (await page("abcdefghijklmnopqrstuv")).text.includes("not valid")]);

  const mine = (await req(student, "GET", "/api/lessons/view")).json?.credential;
  const li = new URL(mine?.linkedIn || "https://x.invalid");
  const q = Object.fromEntries(li.searchParams);
  const issued = new Date(cred.issuedAt);
  check("student portal: their credential link", [`${BASE}/c/${id}`, "EIB Founder Micro-Credential"], [mine?.url, mine?.title]);
  check("LinkedIn link: the certification fields", ["https://www.linkedin.com/profile/add", "CERTIFICATION_NAME", "EIB Founder Micro-Credential", `${BASE}/c/${id}`, id, true, true, true], [li.origin + li.pathname, q.startTask, q.name, q.certUrl, q.certId, Math.abs(Number(q.issueYear) - issued.getUTCFullYear()) <= 1, Number(q.issueMonth) >= 1 && Number(q.issueMonth) <= 12, Boolean(q.organizationId || q.organizationName === "EIB by Nemosyne LTD")]);
  check("a leader has no credential on their lessons page", null, (await req(leader, "GET", "/api/lessons/view")).json?.credential ?? null);

  // The work is copied at release; what the super admin shows is read live.
  await put(story, { text: "SMOKE-CRED-EDITED-LATER" });
  check("an answer edited after release does not change the credential", [true, false], (({ text }) => [text.includes(mark(story)), text.includes("SMOKE-CRED-EDITED-LATER")])(await page(id)));
  await req(admin, "PATCH", G, { hidden: [secret.id, table.id] });
  check("un-ticking a deliverable takes it off a released credential at once", false, (await page(id)).text.includes(mark(table)));
  await req(admin, "PATCH", G, { hidden: [secret.id] });
  check("pressing Release Credentials again releases nobody twice; an active one cannot be released again", [[], 409, id], [(await req(admin, "POST", G, { action: "releaseAll" })).json.released, await code(admin, "POST", G, { action: "release", studentId: "user_amara" }), amara((await req(admin, "GET", G)).json).credential.id]);

  const rev = await req(admin, "POST", G, { action: "revoke", studentId: "user_amara" });
  const gone = await page(id);
  check("revoke: the page says Revoked and shows none of the work", ["revoked", 200, true, false, true, false, false, false], [amara(rev.json).credential.status, gone.status, gone.text.includes("Revoked"), gone.text.includes("Verified"), gone.text.includes("Amara Chen"), gone.text.includes(mark(table)), gone.text.includes(mark(story)), gone.text.includes("Add to LinkedIn")]);
  check("revoke: gone from the student's lessons page; revoking someone with no credential -> 404", [null, 404], [(await req(student, "GET", "/api/lessons/view")).json?.credential ?? null, await code(admin, "POST", G, { action: "revoke", studentId: "user_jack" })]);
  check("Release Credentials leaves a revoked student alone", [[], "revoked"], (({ json }) => [json.released, amara(json).credential.status])(await req(admin, "POST", G, { action: "releaseAll" })));
  const back = await req(admin, "POST", G, { action: "release", studentId: "user_amara" });
  const again = await page(id);
  check("releasing one student again: same link, active, with their work as it is now", [id, "active", true, true], [amara(back.json).credential.id, amara(back.json).credential.status, again.text.includes("Verified"), again.text.includes("SMOKE-CRED-EDITED-LATER")]);
  check("still no email after revoke and re-release", mailBefore, outbox());
  await req(admin, "PATCH", G, { hidden: [], storyDeliverableId: "", criteria: "" });
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
