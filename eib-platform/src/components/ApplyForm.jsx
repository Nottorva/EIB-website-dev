"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Link2, CheckCircle2, Send, LogIn, LogOut, CalendarClock, Lock, ShieldCheck, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { COLORS, FONTS, fieldStyle, Notice, Loading } from "./ui";

const countWords = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;
import { api } from "@/lib/api";
import { fmtLongDateTime, fmtSmartLong } from "@/lib/format";
import { GoogleSignInButton } from "./GoogleButtons";

const fmt = (iso) => fmtLongDateTime(iso, null);
// A notice in the form: big and bold, impossible to miss, with a tick-box the
// applicant has to check (when the notice is marked required) before the
// browser will let the form submit. The server checks it again.
function NoticeCard({ q, ticked, onTick }) {
  const ack = q.ack || "I understand";
  return (
    <div style={{ background: COLORS.warnBg, border: `2px solid ${COLORS.warnText}`, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <AlertTriangle size={26} color={COLORS.warnText} style={{ flexShrink: 0, marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: q.label.length > 70 ? 17.5 : 24, lineHeight: q.label.length > 70 ? 1.45 : 1.2, fontWeight: q.label.length > 70 ? 600 : 600, color: COLORS.ink, letterSpacing: q.label.length > 70 ? 0 : -0.2, whiteSpace: "pre-wrap" }}>{q.label}</div>
          {q.detail && <div style={{ fontSize: 15.5, lineHeight: 1.55, color: COLORS.ink, marginTop: 10, whiteSpace: "pre-wrap" }}>{q.detail}</div>}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, background: COLORS.surface, border: `1px solid ${ticked ? COLORS.successText : COLORS.warnBorder}`, padding: "13px 16px", cursor: "pointer", fontSize: 16, fontWeight: 600, color: COLORS.ink }}>
        <input type="checkbox" checked={ticked} onChange={(e) => onTick(e.target.checked)} required={q.required} style={{ width: 20, height: 20, accentColor: COLORS.successText, cursor: "pointer" }} />
        {ack}
        {q.required && !ticked && <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: COLORS.warnText }}>Required to submit</span>}
      </label>
    </div>
  );
}

// The strip the super admin sees above the form in preview: the window
// state, in the same colours the Forms tab uses for it.
const PREVIEW_STATE = {
  upcoming: { label: "Not open yet", color: COLORS.warnText, soft: COLORS.warnBg, border: COLORS.warnBorder },
  open: { label: "Live", color: COLORS.successText, soft: COLORS.successBg, border: COLORS.successBorder },
  closed: { label: "Closed", color: COLORS.errorText, soft: COLORS.errorBg, border: COLORS.errorBorder },
};
function PreviewStrip({ state, opensAt, closesAt }) {
  const st = PREVIEW_STATE[state] || PREVIEW_STATE.open;
  const when = state === "upcoming" ? `opens ${fmt(opensAt)}` : state === "closed" ? `closed ${fmt(closesAt)}` : closesAt ? `closes ${fmt(closesAt)}` : "no closing time set";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: st.soft, border: `1px solid ${st.border}`, padding: "12px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.white, background: st.color, padding: "4px 10px" }}>{st.label}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: st.color }}>Preview · {when}</span>
      </div>
      <span style={{ fontSize: 12.5, color: COLORS.text2, fontWeight: 600 }}>This is what a signed-in student sees. Signing up is disabled here.</span>
    </div>
  );
}

// Older applications stored a date only; show those without a time.
const fmtSubmitted = (v) => fmtSmartLong(v, null);

// The schedule and the fee are stated inside the form itself (the notices
// applicants tick), so the intro does not repeat them.
function Shell({ children, title = "Sign up for EIB", sub = "Seats are first come, first served. Signing up takes one click; the Student Agreement and the program fee come right after." }) {
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "44px 20px 80px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>EIB · Sign-up</div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 36, fontWeight: 600, color: COLORS.ink }}>{title}</div>
          {sub && <div style={{ fontSize: 15, color: COLORS.text2, marginTop: 8, lineHeight: 1.6 }}>{sub}</div>}
        </div>
        {children}
        <p style={{ fontSize: 12.5, color: COLORS.muted, lineHeight: 1.6, marginTop: 28 }}>
          EIB handles your information as described in the <a href="/privacy" style={{ color: COLORS.ink, fontWeight: 600 }}>Privacy Policy</a>. Using this site means you accept the <a href="/terms" style={{ color: COLORS.ink, fontWeight: 600 }}>Terms</a>.
        </p>
      </div>
    </div>
  );
}

const quietButton = { border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.text2, fontWeight: 600, fontSize: 13, padding: "8px 14px", cursor: "pointer" };

// First come, first served: how many seats are left, or, once the class is
// full, how many of the waitlist's few spots are.
function SeatsNote({ seats }) {
  if (!seats) return null;
  const { cap, seatsLeft, waitlistSpots, waitlistLeft } = seats;
  const classFull = seatsLeft === 0;
  const tone = classFull ? { color: COLORS.warnText, soft: COLORS.warnBg, border: COLORS.warnBorder } : { color: COLORS.successText, soft: COLORS.successBg, border: COLORS.successBorder };
  return (
    <div style={{ fontSize: 13.5, fontWeight: 600, color: tone.color, background: tone.soft, border: `1px solid ${tone.border}`, padding: "10px 14px", marginBottom: 14, lineHeight: 1.5 }}>
      {classFull
        ? `The class is full. You can still join the waitlist: ${waitlistLeft} of its ${waitlistSpots} spots ${waitlistLeft === 1 ? "is" : "are"} left. If a seat opens up, it goes to the first person in line.`
        : `First come, first served: ${seatsLeft} of ${cap} seats left.${waitlistSpots > 0 ? ` Once the class is full there is a waitlist, and it has only ${waitlistSpots} spots.` : ""}`}
    </div>
  );
}

/* What someone sees once they have signed up: exactly one card, saying where
   they landed (in the class, or their place on the waitlist). */
function StatusScreen({ status, onSignOut }) {
  const first = status.applicant?.name?.split(" ")[0];
  const submitted = fmtSubmitted(status.application?.submittedAt || status.appliedAt);
  const decision = status.application?.decision;
  const signOut = (
    <div style={{ marginTop: 18 }}>
      <button type="button" onClick={onSignOut} style={quietButton}>
        Not you? Sign out
      </button>
    </div>
  );

  if (status.account?.suspended) {
    return (
      <Shell title="Your account" sub={null}>
        <BigCard icon={Lock} tone="amber" title="Your account is suspended">
          The EIB student account for <strong>{status.applicant.email}</strong> has been suspended. If you think this is a mistake, speak to an EIB student leader.
          {signOut}
        </BigCard>
      </Shell>
    );
  }

  if (decision === "approved") {
    return (
      <Shell title="Your application" sub={null}>
        <BigCard icon={CheckCircle2} tone="green" title={`You're in${first ? `, ${first}` : ""}`}>
          {status.classStarted === false
            ? "You have a seat in EIB and your student account is ready. Class has not started yet; in the meantime you can read and sign the Student Agreement."
            : "You have a seat in EIB and your student account is ready."}
          <div style={{ marginTop: 20 }}>
            <Link href="/lessons" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.action, color: COLORS.white, fontWeight: 600, fontSize: 15, padding: "12px 20px", textDecoration: "none" }}>
              {status.classStarted === false ? "Continue" : "Open your lessons"} <ArrowRight size={16} />
            </Link>
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 16 }}>Signed up {submitted}.</div>
        </BigCard>
      </Shell>
    );
  }

  if (decision === "denied") {
    return (
      <Shell title="Your application" sub={null}>
        <BigCard icon={ShieldCheck} tone="gray" title="Thank you for applying">
          We read every application carefully, and we are not able to offer you a place in this cohort. We hope you apply again next year.
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 16 }}>Application submitted {submitted}.</div>
          {signOut}
        </BigCard>
      </Shell>
    );
  }

  if (decision === "waitlist") {
    const place = status.application.waitlistPosition;
    const spots = status.seats?.waitlistSpots;
    return (
      <Shell title="Your application" sub={null}>
        <BigCard icon={CalendarClock} tone="amber" title={place ? `You're number ${place} on the waitlist` : "You're on the waitlist"}>
          {place
            ? <>The class is full, so you are on the waitlist. The waitlist has only {spots} spots and you hold number {place}. If a seat opens up it goes to the first person in line, and we will email <strong>{status.applicant.email}</strong> the moment one is yours.</>
            : "Thank you for applying. We could not offer you a place right away, but you are on the waitlist and we will be in touch as soon as a spot opens up."}
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 16 }}>Application submitted {submitted}.</div>
          {signOut}
        </BigCard>
      </Shell>
    );
  }

  return (
    <Shell title="Your application" sub={null}>
      <BigCard icon={Clock} tone="indigo" title="Thank you for applying">
        Your application is under review. You will hear back at <strong>{status.applicant.email}</strong> once decisions are released.
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, background: COLORS.bg, color: COLORS.ink, fontWeight: 600, fontSize: 13.5, padding: "8px 14px" }}>
          <CheckCircle2 size={15} /> Submitted {submitted}
        </div>
        {signOut}
      </BigCard>
    </Shell>
  );
}

function BigCard({ icon: Icon, tone = "indigo", title, children }) {
  const tones = {
    indigo: { bg: COLORS.bg, color: COLORS.ink },
    amber: { bg: COLORS.warnBg, color: COLORS.warnText },
    green: { bg: COLORS.successBg, color: COLORS.successText },
    gray: { bg: COLORS.bg, color: COLORS.text2 },
  };
  const t = tones[tone];
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 28, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon size={26} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: FONTS.serif, fontSize: 26, fontWeight: 600, color: COLORS.ink, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/* Real Google sign-in (production) or the sandbox stand-in, restricted to the school domain. */
function SignInCard({ domain, onSignedIn, authMode, signInAvailable }) {
  if (!signInAvailable) {
    return (
      <BigCard icon={Lock} tone="amber" title="Sign-in isn't set up yet">
        Applying requires signing in with a school Google account, and Google sign-in has not been configured on this site yet. An EIB admin needs to finish that step first.
      </BigCard>
    );
  }
  if (authMode === "google") {
    return (
      <SignInShell domain={domain}>
        <GoogleSignInButton callbackUrl="/apply" label={`Sign in with your @${domain} Google account`} style={{ width: "100%" }} />
      </SignInShell>
    );
  }
  return <DevSignInCard domain={domain} onSignedIn={onSignedIn} />;
}

// The card both sign-in variants share: lock, heading and the one-line explanation.
function SignInShell({ domain, children }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, background: COLORS.bg, color: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={20} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 24, fontWeight: 600, color: COLORS.ink }}>Students: sign in to sign up</div>
      </div>
      <div style={{ fontSize: 14.5, color: COLORS.text2, lineHeight: 1.6, marginBottom: 18 }}>
        Use your <strong>@{domain}</strong> Google account. Your name and school email come from that account, so there is nothing to fill in.
      </div>
      {children}
    </div>
  );
}

function DevSignInCard({ domain, onSignedIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/apply/session", { name, email });
      onSignedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SignInShell domain={domain}>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name (as on your school account)" aria-label="Full name, as on your school account" autoComplete="name" required style={fieldStyle} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${domain}`} aria-label="School email address" autoComplete="email" required style={fieldStyle} />
        <button
          type="submit"
          disabled={busy}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: busy ? COLORS.disabled : COLORS.action, color: COLORS.white, border: "none", padding: "13px", fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
        >
          <LogIn size={16} /> Sign in with your TFS Google account
        </button>
      </form>
      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 1.5 }}>Sandbox: this stand-in asks for the name and email that Google would provide. In production this button opens the real Google sign-in, restricted to @{domain}.</div>
    </SignInShell>
  );
}

// A parent or guardian signs their child up without the student: their own
// name and email, the student's name and school email. They are emailed a
// link; the seat is taken when they open it.
function ParentCard({ domain }) {
  const [form, setForm] = useState({ parentName: "", parentEmail: "", studentName: "", studentEmail: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post("/api/apply/parent", form);
      setSentTo(r.parentEmailMasked);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  if (sentTo) {
    return (
      <div style={{ marginTop: 16 }}>
        <BigCard icon={CheckCircle2} tone="green" title="Check your email">
          We sent a link to <strong>{sentTo}</strong>. The seat is taken the moment you open it, so open it as soon as you can. The same link then lets you sign the Student Agreement and see how to pay the program fee. If it has not arrived in a minute, look in the spam folder.
        </BigCard>
      </div>
    );
  }
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 28, marginTop: 16 }}>
      <div style={{ fontFamily: FONTS.serif, fontSize: 24, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Parent or guardian? Sign your child up</div>
      <div style={{ fontSize: 14.5, color: COLORS.text2, lineHeight: 1.6, marginBottom: 18 }}>
        You can do this without your child. We email you a link to confirm your address; the seat is taken the moment you open it, and you then sign the Student Agreement and see how to pay the program fee yourself.
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={form.parentName} onChange={set("parentName")} placeholder="Your full name" aria-label="Your full name" autoComplete="name" required style={fieldStyle} />
        <input type="email" value={form.parentEmail} onChange={set("parentEmail")} placeholder="Your email address" aria-label="Your email address" autoComplete="email" required style={fieldStyle} />
        <input value={form.studentName} onChange={set("studentName")} placeholder="Student's full name" aria-label="Student's full name" autoComplete="off" required style={fieldStyle} />
        <input type="email" value={form.studentEmail} onChange={set("studentEmail")} placeholder={`Student's school email (@${domain})`} aria-label={`Student's school email, ending in @${domain}`} autoComplete="off" required style={fieldStyle} />
        <button type="submit" disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: busy ? COLORS.disabled : COLORS.action, color: COLORS.white, border: "none", padding: "13px", fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          <Send size={16} /> {busy ? "Sending…" : "Email me the link"}
        </button>
      </form>
    </div>
  );
}

export default function ApplyForm() {
  const [status, setStatus] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [restored, setRestored] = useState(false);
  const load = () =>
    api
      .get("/api/apply/status")
      .then((s) => {
        setStatus(s);
        // first load with a saved draft: pick up where they left off
        if (s.draft?.answers?.length) {
          const fromDraft = Object.fromEntries(s.draft.answers.map((a) => [a.questionId, a.answer]));
          setAnswers((prev) => (Object.keys(prev).length ? prev : fromDraft));
          // what the server already holds: no save until something changes
          lastSaved.current = JSON.stringify({ answers: s.form.map((q) => ({ questionId: q.id, answer: fromDraft[q.id] ?? "" })) });
          setRestored(true);
        }
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const set = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  // While the form is open to a signed-in applicant, their answers are saved
  // server-side as they type: 2.5s after the last change, only when something
  // changed since the last successful save, retried a few times on failure,
  // and flushed with a beacon if they leave the page mid-way. The save state
  // is shown under their name. Nothing is saved in preview or once applied.
  const formLive = Boolean(status?.form?.length && status?.applicant && status.state === "open" && status.domainOk !== false && !status.alreadyApplied && !status.account?.suspended);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const lastSaved = useRef(null);
  const payloadRef = useRef(null);
  const draftPayload = () => JSON.stringify({ answers: status.form.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })) });
  const saveDraft = async (attempt = 0) => {
    const body = payloadRef.current;
    if (body == null || body === lastSaved.current) return;
    setSaveState("saving");
    try {
      await api.post("/api/apply/draft", JSON.parse(body));
      lastSaved.current = body;
      setSaveState("saved");
    } catch (err) {
      if (err.status === 409 || err.status === 403 || err.status === 401) { setSaveState("idle"); return; } // not a form that can be saved any more
      if (attempt < 3) {
        setTimeout(() => saveDraft(attempt + 1), [2000, 5000, 10000][attempt]);
        setSaveState("saving");
      } else {
        setSaveState("error");
      }
    }
  };
  useEffect(() => {
    if (!formLive) return undefined;
    payloadRef.current = draftPayload();
    if (payloadRef.current === lastSaved.current) return undefined;
    const t = setTimeout(() => saveDraft(0), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formLive, answers]);
  useEffect(() => {
    if (!formLive) return undefined;
    const flush = () => {
      const body = payloadRef.current;
      if (body == null || body === lastSaved.current || typeof navigator.sendBeacon !== "function") return;
      if (navigator.sendBeacon("/api/apply/draft", new Blob([body], { type: "application/json" }))) lastSaved.current = body;
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    return () => window.removeEventListener("pagehide", flush);
  }, [formLive]);

  const signOut = async () => {
    if (status?.authMode === "google") {
      nextAuthSignOut({ callbackUrl: "/apply" });
      return;
    }
    await api.del("/api/apply/session");
    setAnswers({});
    load();
  };

  const submit = async (e) => {
    e.preventDefault();
    const over = status.form.find((q) => q.type === "long" && q.maxWords && countWords(answers[q.id]) > q.maxWords);
    if (over) {
      setError(`"${over.label}" is over the ${over.maxWords}-word limit.`);
      document.getElementById(`q-${over.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.post("/api/apply", {});
      // a seat: straight to the Student Agreement (payment follows it)
      if (r.placed === "class") {
        window.location.href = "/onboarding";
        return;
      }
      // The status page takes over from here (in the class, or on the waitlist).
      await load();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!status) {
    return (
      <Shell>
        {error ? <Notice>{error}</Notice> : <Loading />}
      </Shell>
    );
  }

  // Someone who has applied (or holds a suspended account) sees their status
  // whatever the window state is; the window only gates new applications.
  if (status.applicant && (status.alreadyApplied || status.account?.suspended)) {
    return <StatusScreen status={status} onSignOut={signOut} />;
  }

  const title = status.title || "Apply to EIB";
  // Super admin looking at the link without an applicant sign-in: show the
  // form as applicants get it, whatever the window state, with a strip on
  // top saying which state that is. Submitting is disabled in this mode.
  const preview = Boolean(status.previewer && !status.applicant);

  if (!preview && status.state === "upcoming") {
    return (
      <Shell title={title}>
        <BigCard icon={CalendarClock} tone="amber" title="Applications aren't open yet">
          This link goes live on <strong>{fmt(status.opensAt)}</strong>. Come back then; the link stays the same.
          {status.closesAt && <div style={{ marginTop: 8 }}>Applications close on {fmt(status.closesAt)}.</div>}
        </BigCard>
      </Shell>
    );
  }

  if (!preview && status.state === "closed") {
    return (
      <Shell title={title}>
        <BigCard icon={Lock} tone="gray" title="Applications have closed">
          The application window closed on <strong>{fmt(status.closesAt)}</strong>. If you think that's a mistake, contact an EIB student leader.
        </BigCard>
      </Shell>
    );
  }

  // No seat and no waitlist spot left: nothing to fill in.
  if (!preview && status.seats?.full) {
    return (
      <Shell title={title}>
        <BigCard icon={Lock} tone="gray" title="The class is full">
          All {status.seats.cap} seats{status.seats.waitlistSpots > 0 ? <> and all {status.seats.waitlistSpots} waitlist spots</> : null} have been taken, so sign-up is closed.
        </BigCard>
      </Shell>
    );
  }

  if (!preview && !status.applicant) {
    return (
      <Shell title={title}>
        <SeatsNote seats={status.seats} />
        {status.closesAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: COLORS.warnText, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "10px 14px", marginBottom: 14 }}>
            <CalendarClock size={15} /> Applications close {fmt(status.closesAt)}
          </div>
        )}
        <SignInCard domain={status.applicantDomain} onSignedIn={load} authMode={status.authMode} signInAvailable={status.signInAvailable} />
        <ParentCard domain={status.applicantDomain} />
      </Shell>
    );
  }

  if (!preview && status.domainOk === false) {
    return (
      <Shell title={title}>
        <BigCard icon={Lock} tone="amber" title={`Please use your @${status.applicantDomain} account`}>
          You're signed in as <strong>{status.applicant.email}</strong>, which isn't a school account. Students: sign out and choose your @{status.applicantDomain} Google account instead. Parents and guardians: use the form below.
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={signOut} style={{ border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.text2, fontWeight: 600, fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </BigCard>
        <ParentCard domain={status.applicantDomain} />
      </Shell>
    );
  }

  return (
    <Shell title={title}>
      {preview ? (
        <PreviewStrip state={status.state} opensAt={status.opensAt} closesAt={status.closesAt} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={18} color={COLORS.successText} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{status.applicant.name}</div>
              <div style={{ fontSize: 12.5, color: COLORS.muted }}>{status.applicant.email}</div>
            </div>
          </div>
          <button type="button" onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.action, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
            <LogOut size={13} /> Not you? Sign out
          </button>
        </div>
      )}
      {!preview && status.form.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12.5, color: COLORS.muted, margin: "-6px 2px 14px" }}>
          <span>{restored ? "Welcome back. Your answers from last time are here; carry on and submit when you're ready." : "Your answers save as you type, so you can come back and finish later."}</span>
          <span style={{ fontWeight: 600, color: saveState === "error" ? COLORS.errorText : saveState === "saved" ? COLORS.successText : COLORS.muted, whiteSpace: "nowrap" }}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? (
              <>Not saved yet · <button type="button" onClick={() => saveDraft(0)} style={{ border: "none", background: "transparent", color: COLORS.errorText, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 12.5, textDecoration: "underline" }}>retry</button></>
            ) : ""}
          </span>
        </div>
      )}
      {status.closesAt && (!preview || status.state === "open") && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: COLORS.warnText, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "10px 14px", marginBottom: 14 }}>
          <CalendarClock size={15} /> Applications close {fmt(status.closesAt)}
        </div>
      )}

      <SeatsNote seats={status.seats} />

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <form onSubmit={preview ? (e) => e.preventDefault() : submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {status.form.map((q) => q.type === "notice" ? (
          <NoticeCard key={q.id} q={q} ticked={answers[q.id] === (q.ack || "I understand")} onTick={(on) => set(q.id, on ? q.ack || "I understand" : "")} />
        ) : (
          <div key={q.id} id={`q-${q.id}`} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 18 }}>
            <div id={`l-${q.id}`} style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: q.help ? 4 : 10, lineHeight: 1.45 }}>
              {q.label}
              {q.required ? <span style={{ color: COLORS.errorText, marginLeft: 4 }}><span aria-hidden="true">*</span><span className="sr-only"> (required)</span></span> : <span style={{ color: COLORS.muted, fontWeight: 600, marginLeft: 6, fontSize: 12.5 }}>optional</span>}
            </div>
            {q.help && <div id={`h-${q.id}`} style={{ fontSize: 13.5, color: COLORS.text2, marginBottom: 10, lineHeight: 1.5 }}>{q.help}</div>}

            {q.type === "short" && <input id={`f-${q.id}`} aria-labelledby={`l-${q.id}`} aria-describedby={q.help ? `h-${q.id}` : undefined} value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} style={fieldStyle} />}

            {q.type === "long" && (
              <div>
                <textarea id={`f-${q.id}`} aria-labelledby={`l-${q.id}`} aria-describedby={[q.help ? `h-${q.id}` : null, q.maxWords ? `w-${q.id}` : null].filter(Boolean).join(" ") || undefined} value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} rows={q.maxWords ? 6 : 4} style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }} />
                {q.maxWords > 0 && (() => {
                  const n = countWords(answers[q.id]);
                  const over = n > q.maxWords;
                  return (
                    <div id={`w-${q.id}`} aria-live="polite" style={{ textAlign: "right", fontSize: 12.5, fontWeight: 600, color: over ? COLORS.errorText : COLORS.muted, marginTop: 6 }}>
                      {n} / {q.maxWords} words{over ? " · over the limit" : ""}
                    </div>
                  );
                })()}
              </div>
            )}

            {q.type === "choice" && (
              <div role="radiogroup" aria-labelledby={`l-${q.id}`} aria-describedby={q.help ? `h-${q.id}` : undefined} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt;
                  return (
                    <label
                      key={opt}
                      style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${active ? COLORS.ink : COLORS.border}`, background: active ? COLORS.bg : COLORS.white, padding: "10px 12px", cursor: "pointer", fontSize: 14.5, fontWeight: 600, color: active ? COLORS.ink : COLORS.ink }}
                    >
                      <input type="radio" name={q.id} value={opt} checked={active} onChange={() => set(q.id, opt)} required={q.required} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "link" && (
              <div>
                <div style={{ position: "relative" }}>
                  <Link2 size={15} color={COLORS.muted} style={{ position: "absolute", left: 14, top: 15 }} />
                  <input id={`f-${q.id}`} aria-labelledby={`l-${q.id}`} aria-describedby={q.help ? `h-${q.id}` : undefined} type="url" value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} placeholder="https://" style={{ ...fieldStyle, paddingLeft: 38 }} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>Paste a link (Google Drive, Docs, a website). Make sure it is shared so anyone with the link can view.</div>
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting || preview}
          title={preview ? "Submitting is disabled in preview" : undefined}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: submitting || preview ? COLORS.disabled : COLORS.action, color: COLORS.white, border: "none", padding: "15px", fontSize: 16, fontWeight: 600, cursor: submitting ? "default" : "pointer", marginTop: 6 }}
        >
          <Send size={16} /> {preview ? "Sign up (disabled in preview)" : submitting ? "Signing you up…" : status.seats?.seatsLeft === 0 ? "Join the waitlist" : "Sign up"}
        </button>
      </form>
      {/* the super admin's preview shows the whole page a visitor gets, the parents' form included */}
      {preview && <ParentCard domain={status.applicantDomain} />}
    </Shell>
  );
}
