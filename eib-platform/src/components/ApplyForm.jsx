"use client";

import React, { useEffect, useState } from "react";
import { Link2, CheckCircle2, Send, LogIn, LogOut, CalendarClock, Lock, ShieldCheck } from "lucide-react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { COLORS, fieldStyle, Notice, Loading } from "./ui";
import { api } from "@/lib/api";
import { GoogleSignInButton } from "./GoogleButtons";

const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) : null);

function Shell({ children }) {
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "44px 20px 80px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>EIB · Application</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>Apply to EIB</div>
          <div style={{ fontSize: 15, color: COLORS.sub, marginTop: 8, lineHeight: 1.6 }}>Weekly Tuesday sessions, November to March. Tell us about yourself and a problem you'd want to work on.</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function BigCard({ icon: Icon, tone = "indigo", title, children }) {
  const tones = {
    indigo: { bg: COLORS.indigoSoft, color: COLORS.indigo },
    amber: { bg: COLORS.amberSoft, color: COLORS.amber },
    green: { bg: COLORS.greenSoft, color: COLORS.green },
    gray: { bg: "#f1f3f7", color: COLORS.sub },
  };
  const t = tones[tone];
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon size={26} strokeWidth={2.25} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 15, color: COLORS.sub, lineHeight: 1.6 }}>{children}</div>
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
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.indigoSoft, color: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={20} strokeWidth={2.25} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>Sign in to apply</div>
        </div>
        <div style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6, marginBottom: 18 }}>
          Use your <strong>@{domain}</strong> Google account. Your name and school email come from that account, so you won't need to type them into the form.
        </div>
        <GoogleSignInButton callbackUrl="/apply" label={`Sign in with your @${domain} Google account`} style={{ width: "100%" }} />
      </div>
    );
  }
  return <DevSignInCard domain={domain} onSignedIn={onSignedIn} />;
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
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.indigoSoft, color: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lock size={20} strokeWidth={2.25} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>Sign in to apply</div>
      </div>
      <div style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6, marginBottom: 18 }}>
        Use your <strong>@{domain}</strong> Google account. Your name and school email come from that account, so you won't need to type them into the form.
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name (as on your school account)" required style={fieldStyle} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`you@${domain}`} required style={fieldStyle} />
        <button
          type="submit"
          disabled={busy}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: busy ? "#d7dbe4" : COLORS.indigo, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer" }}
        >
          <LogIn size={16} /> Sign in with your TFS Google account
        </button>
      </form>
      <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 12, lineHeight: 1.5 }}>Sandbox: this stand-in asks for the name and email that Google would provide. In production this button opens the real Google sign-in, restricted to @{domain}.</div>
    </div>
  );
}

export default function ApplyForm() {
  const [status, setStatus] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const load = () => api.get("/api/apply/status").then(setStatus).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const set = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

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
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/apply", { answers: status.form.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" })) });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Shell>
        <BigCard icon={CheckCircle2} tone="green" title="Application received">
          Thanks for applying to EIB, {status?.applicant?.name?.split(" ")[0]}. You'll hear back at <strong>{status?.applicant?.email}</strong> once applications have been reviewed.
          <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 18 }}>Sandbox note: this application now shows as "Pending" in the Student Manager.</div>
        </BigCard>
      </Shell>
    );
  }

  if (!status) {
    return (
      <Shell>
        {error ? <Notice>{error}</Notice> : <Loading />}
      </Shell>
    );
  }

  if (status.state === "upcoming") {
    return (
      <Shell>
        <BigCard icon={CalendarClock} tone="amber" title="Applications aren't open yet">
          This link goes live on <strong>{fmt(status.opensAt)}</strong>. Come back then; the link stays the same.
          {status.closesAt && <div style={{ marginTop: 8 }}>Applications close on {fmt(status.closesAt)}.</div>}
        </BigCard>
      </Shell>
    );
  }

  if (status.state === "closed") {
    return (
      <Shell>
        <BigCard icon={Lock} tone="gray" title="Applications have closed">
          The application window closed on <strong>{fmt(status.closesAt)}</strong>. If you think that's a mistake, contact an EIB student leader.
        </BigCard>
      </Shell>
    );
  }

  if (!status.applicant) {
    return (
      <Shell>
        {status.closesAt && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: COLORS.amber, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <CalendarClock size={15} /> Applications close {fmt(status.closesAt)}
          </div>
        )}
        <SignInCard domain={status.applicantDomain} onSignedIn={load} authMode={status.authMode} signInAvailable={status.signInAvailable} />
      </Shell>
    );
  }

  if (status.domainOk === false) {
    return (
      <Shell>
        <BigCard icon={Lock} tone="amber" title={`Please use your @${status.applicantDomain} account`}>
          You're signed in as <strong>{status.applicant.email}</strong>, which isn't a school account. Sign out and choose your @{status.applicantDomain} Google account instead.
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={signOut} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        </BigCard>
      </Shell>
    );
  }

  if (status.alreadyApplied) {
    return (
      <Shell>
        <BigCard icon={ShieldCheck} tone="green" title="You've already applied">
          We received an application from <strong>{status.applicant.email}</strong>{status.appliedAt ? ` on ${status.appliedAt}` : ""}. One application per student; you'll hear back once reviews are done.
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={signOut} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
              Not you? Sign out
            </button>
          </div>
        </BigCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} color={COLORS.green} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{status.applicant.name}</div>
            <div style={{ fontSize: 12.5, color: COLORS.faint }}>{status.applicant.email}</div>
          </div>
        </div>
        <button type="button" onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.sub, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          <LogOut size={13} /> Not you? Sign out
        </button>
      </div>
      {status.closesAt && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: COLORS.amber, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
          <CalendarClock size={15} /> Applications close {fmt(status.closesAt)}
        </div>
      )}

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {status.form.map((q) => (
          <div key={q.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 10 }}>
              {q.label}
              {q.required && <span style={{ color: COLORS.red, marginLeft: 4 }}>*</span>}
            </div>

            {q.type === "short" && <input value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} style={fieldStyle} />}

            {q.type === "long" && <textarea value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} rows={4} style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }} />}

            {q.type === "choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt;
                  return (
                    <label
                      key={opt}
                      style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${active ? COLORS.indigo : COLORS.border}`, background: active ? COLORS.indigoSoft : "#fff", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 14.5, fontWeight: 600, color: active ? COLORS.indigo : COLORS.text }}
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
                  <Link2 size={15} color={COLORS.faint} style={{ position: "absolute", left: 14, top: 15 }} />
                  <input type="url" value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} required={q.required} placeholder="https://" style={{ ...fieldStyle, paddingLeft: 38 }} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 8 }}>Paste a link (Google Drive, Docs, a website). Make sure it is shared so anyone with the link can view.</div>
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: submitting ? "#d7dbe4" : COLORS.indigo, color: "#fff", border: "none", borderRadius: 13, padding: "15px", fontSize: 16, fontWeight: 800, cursor: submitting ? "default" : "pointer", marginTop: 6 }}
        >
          <Send size={16} /> {submitting ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </Shell>
  );
}
