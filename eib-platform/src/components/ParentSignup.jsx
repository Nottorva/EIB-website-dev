"use client";

// The page behind a parent's emailed sign-up link: where their child's
// sign-up stands, the Student Agreement to read and sign on their own, and
// how to pay the program fee.

import { useState } from "react";
import { CircleCheck, CalendarClock, Lock, AlertTriangle, ShieldCheck, Download } from "lucide-react";
import { COLORS, fieldStyle, Notice } from "./ui";
import { api } from "@/lib/api";
import PdfReader from "./PdfReader";
import PaymentCard from "./PaymentCard";

const CLOSED = {
  invalid: { icon: AlertTriangle, tone: "red", title: "This link is not recognised", body: () => "It may have been copied incompletely, it may have expired, or a newer link has since been emailed to you. Please use the most recent email from EIB, or start again from the sign-up page." },
  removed: { icon: Lock, tone: "gray", title: "This sign-up is no longer active", body: (s) => `${s || "The student"}'s sign-up was removed. If you think that is a mistake, contact an EIB student leader.` },
  taken: { icon: CircleCheck, tone: "green", title: "Already signed up", body: (s) => `${s || "The student"} signed up from their own school account, so there is nothing more to do here. Their Student Agreement is signed from their account.` },
  full: { icon: Lock, tone: "gray", title: "The class is full", body: (s) => `By the time this link was opened, every seat and every waitlist spot had been taken, so we could not sign ${s || "the student"} up. We are sorry.` },
};
const TONES = {
  red: { bg: COLORS.redSoft, color: COLORS.red },
  gray: { bg: "#f1f3f7", color: COLORS.sub },
  green: { bg: COLORS.greenSoft, color: COLORS.green },
  amber: { bg: COLORS.amberSoft, color: COLORS.amber },
};

function Shell({ children }) {
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "36px 20px 70px" }}>
      <main style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>EIB · Sign-up for parents and guardians</div>
        {children}
      </main>
    </div>
  );
}
function Card({ children, style }) {
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 22, ...style }}>{children}</div>;
}
function Headline({ icon: Icon, tone, title, children }) {
  const t = TONES[tone];
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={23} strokeWidth={2.25} />
        </div>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, margin: "2px 0 6px" }}>{title}</h1>
          <div style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6 }}>{children}</div>
        </div>
      </div>
    </Card>
  );
}

// One of the super admin's own questions. A parent signing alone answers all of them.
function Question({ q, value, onChange, box, label }) {
  const id = `q-${q.id}`;
  if (q.type === "notice") {
    const ack = q.ack || "I understand";
    return (
      <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: COLORS.text, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{q.label}</div>
        {q.detail && <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.55, marginTop: 6, whiteSpace: "pre-wrap" }}>{q.detail}</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14.5, fontWeight: 800, color: COLORS.text, cursor: "pointer" }}>
          <input type="checkbox" checked={value === ack} onChange={(e) => onChange(e.target.checked ? ack : "")} required={q.required} style={{ width: 18, height: 18 }} />
          {ack}
        </label>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} style={label}>
        {q.label}
        {!q.required && <span style={{ fontWeight: 600, color: COLORS.faint }}> (optional)</span>}
      </label>
      {q.type === "long" ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} required={q.required} rows={4} style={{ ...box, resize: "vertical" }} />
      ) : q.type === "choice" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={q.required} style={{ ...box, background: "#fff" }}>
          <option value="">Choose…</option>
          {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input id={id} type={q.type === "link" ? "url" : "text"} placeholder={q.type === "link" ? "https://" : undefined} value={value} onChange={(e) => onChange(e.target.value)} required={q.required} autoComplete="off" style={box} />
      )}
      {q.help && <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 6 }}>{q.help}</div>}
    </div>
  );
}

export default function ParentSignup({ state, token, studentName, parentName, position, waitlistSpots, signed: signedAtLoad, toSign, agreement, payment, paid }) {
  const [signed, setSigned] = useState(Boolean(signedAtLoad));
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [openedPdf, setOpenedPdf] = useState(false);
  const [form, setForm] = useState({ readConfirmed: false, parentSignature: "", parentRelationship: "", parentConfirmed: false, answers: {} });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const student = studentName || "the student";

  if (CLOSED[state]) {
    const c = CLOSED[state];
    return (
      <Shell>
        <Headline icon={c.icon} tone={c.tone} title={c.title}>{c.body(studentName)}</Headline>
      </Shell>
    );
  }

  if (state === "waitlist") {
    return (
      <Shell>
        <Headline icon={CalendarClock} tone="amber" title={`${studentName || "Your child"} is number ${position} on the waitlist`}>
          The class is full, so {student} is on the waitlist. The waitlist has only {waitlistSpots} spots and {student} holds number {position}. If a seat opens up it goes to the first person in line, and we will email you a new link the moment it is theirs. There is nothing to sign or pay until then.
        </Headline>
      </Shell>
    );
  }

  const pdfSrc = `/api/agreement/pdf?token=${token}`;
  const canSign = reachedEnd || (viewerFailed && openedPdf);
  const w = agreement?.wording || {};
  const box = { ...fieldStyle, padding: "10px 12px", fontSize: 14.5, borderRadius: 10 };
  const label = { fontSize: 12, fontWeight: 800, color: COLORS.sub, letterSpacing: 0.3, marginBottom: 6, display: "block" };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/apply/parent/sign", { token, ...form });
      setSigned(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // In the class, and nothing left to sign: the agreement is done (or there is none).
  if (signed || !toSign) {
    return (
      <Shell>
        <Headline icon={CircleCheck} tone="green" title={signed ? "The Student Agreement is signed" : `${studentName || "Your child"} has a seat in EIB`}>
          {signed
            ? `Thank you${parentName ? `, ${parentName.split(" ")[0]}` : ""}. ${studentName || "Your child"} has a seat in EIB and the agreement is complete. They sign in with their school account to open their lessons once class starts; they do not need to sign anything.`
            : `${studentName || "Your child"} signs in with their school account to get started.`}
          {signed && (
            <div style={{ marginTop: 14 }}>
              <a href={`${pdfSrc}&download=1`} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 14px", textDecoration: "none" }}>
                <Download size={15} /> Download the agreement
              </a>
            </div>
          )}
        </Headline>
        <PaymentCard payment={payment} paid={paid} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Headline icon={CircleCheck} tone="green" title={`${studentName || "Your child"} has a seat in EIB`}>
        Two things are left, and you can do both here without {student}: read and sign the Student Agreement below, then pay the program fee.
      </Headline>

      <Card style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: COLORS.text, margin: 0 }}>{agreement.title}</h2>
          <a href={`${pdfSrc}&download=1`} onClick={() => setOpenedPdf(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 14px", textDecoration: "none" }}>
            <Download size={15} /> Download as PDF
          </a>
        </div>
        <p style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6, margin: "12px 0 0" }}>Please read the whole agreement. Once you have reached the end, you can sign it below on {student}'s behalf.</p>
      </Card>

      <section aria-label="The agreement" style={{ margin: "16px 0" }}>
        <PdfReader src={pdfSrc} onReachEnd={() => setReachedEnd(true)} onError={() => setViewerFailed(true)} />
      </section>

      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: canSign ? COLORS.green : COLORS.amber, background: canSign ? COLORS.greenSoft : COLORS.amberSoft, border: `1px solid ${canSign ? COLORS.greenBorder : COLORS.amberBorder}`, borderRadius: 12, padding: "10px 14px" }}>
            {canSign ? <CircleCheck size={16} /> : <Lock size={16} />}
            {canSign ? "You've reached the end. You can sign below." : viewerFailed ? "The viewer could not load. Open the PDF with the download button, read it, then sign below." : "Scroll through the whole agreement to unlock the signature section."}
          </div>
          <fieldset disabled={!canSign} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18, opacity: canSign ? 1 : 0.55 }}>
            <legend className="sr-only">Your signature</legend>
            <div>
              <label htmlFor="student-name" style={label}>Student name</label>
              <input id="student-name" value={studentName} readOnly aria-readonly="true" style={{ ...box, background: "#f7f8fb", color: COLORS.sub }} />
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: COLORS.text, cursor: "pointer" }}>
              <input type="checkbox" checked={form.readConfirmed} onChange={(e) => set("readConfirmed", e.target.checked)} required style={{ width: 18, height: 18, marginTop: 2 }} />
              <span>{w.readStatement}</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div>
                <label htmlFor="parent-signature" style={label}>{w.parentSignatureLabel}</label>
                <input id="parent-signature" value={form.parentSignature} onChange={(e) => set("parentSignature", e.target.value)} placeholder="Type your full name" maxLength={60} autoComplete="off" required style={{ ...box, fontStyle: form.parentSignature ? "italic" : "normal" }} />
                <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 6 }}>Typing your name here is your signature.</div>
              </div>
              <div>
                <label htmlFor="parent-rel" style={label}>{w.relationshipLabel}</label>
                <select id="parent-rel" value={form.parentRelationship} onChange={(e) => set("parentRelationship", e.target.value)} required style={{ ...box, background: "#fff" }}>
                  <option value="">Choose…</option>
                  {(agreement.relationships || []).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {(agreement.questions || []).map((q) => (
              <Question key={q.id} q={q} value={form.answers[q.id] || ""} onChange={(v) => setForm((f) => ({ ...f, answers: { ...f.answers, [q.id]: v } }))} box={box} label={label} />
            ))}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: COLORS.text, cursor: "pointer" }}>
              <input type="checkbox" checked={form.parentConfirmed} onChange={(e) => set("parentConfirmed", e.target.checked)} required style={{ width: 18, height: 18, marginTop: 2 }} />
              <span>{String(w.parentOnlyStatement || "").split("{student}").join(student)}</span>
            </label>
          </fieldset>
          {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
          <button type="submit" disabled={!canSign || busy} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: canSign ? COLORS.indigo : "#d7dbe4", color: canSign ? "#fff" : COLORS.faint, fontWeight: 900, fontSize: 15, borderRadius: 999, padding: "13px 22px", cursor: canSign && !busy ? "pointer" : "default", alignSelf: "flex-start", fontFamily: "inherit" }}>
            <ShieldCheck size={17} /> {busy ? "Saving…" : "I agree"}
          </button>
          <p style={{ fontSize: 12.5, color: COLORS.faint, lineHeight: 1.6, margin: 0 }}>
            Your signature completes the agreement; {student} does not need to sign. Your name and email are kept only as the record of this consent. See the <a href="/privacy" style={{ color: COLORS.indigo, fontWeight: 700 }}>Privacy Policy</a>.
          </p>
        </form>
      </Card>
    </Shell>
  );
}
