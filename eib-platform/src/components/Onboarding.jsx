"use client";

// Student onboarding: read the Student Agreement to the end, confirm, sign
// with typed initials, and have a parent or legal guardian sign too. The
// Lessons page stays closed until this is done. The super admin can preview
// the page; only a student can sign.

import React, { useEffect, useState } from "react";
import { FileText, Download, CircleCheck, Lock, ArrowRight, ShieldCheck, Mail, Clock } from "lucide-react";
import { SECTION_13, AGREEMENT_VERSION_LABEL } from "@/lib/agreementText";
import { COLORS, fieldStyle, Notice, Loading } from "./ui";
import { api } from "@/lib/api";
import PdfReader from "./PdfReader";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" }) : "");

export default function Onboarding({ user }) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [openedPdf, setOpenedPdf] = useState(false);
  const [form, setForm] = useState({ readConfirmed: false, studentInitials: "", parentName: "", parentEmail: "", parentRelationship: "", parentInitials: "", parentConfirmed: false });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [resendMsg, setResendMsg] = useState(null);
  const [resending, setResending] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const resend = async () => {
    setResending(true);
    setResendMsg(null);
    try {
      const r = await api.post("/api/agreement/resend", {});
      setMeta((m) => ({ ...m, record: r.agreement }));
      setResendMsg({ ok: true, text: `Sent again to ${r.agreement.parentEmailMasked}.` });
    } catch (e) {
      setResendMsg({ ok: false, text: e.message });
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    api.get("/api/agreement").then(setMeta).catch((e) => setError(e.message));
  }, []);

  const preview = user.role !== "student";
  const canSign = reachedEnd || (viewerFailed && openedPdf);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (preview) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.post("/api/agreement/accept", form);
      setDone(r.agreement);
      if (r.warning) setResendMsg({ ok: false, text: r.warning });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!meta) return <Shell>{error ? <Notice>{error}</Notice> : <Loading />}</Shell>;

  const record = done || meta.record;
  if (record && !preview) {
    const signed = record.status === "signed";
    const canResendAt = record.canResendAt ? new Date(record.canResendAt).getTime() : 0;
    const waitMin = Math.max(0, Math.ceil((canResendAt - Date.now()) / 60000));
    void tick;
    return (
      <Shell>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: signed ? COLORS.greenSoft : COLORS.amberSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {signed ? <CircleCheck size={22} color={COLORS.green} strokeWidth={2.25} /> : <Clock size={22} color={COLORS.amber} strokeWidth={2.25} />}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.text }}>{signed ? "Agreement signed" : "Waiting for your guardian to confirm"}</div>
              <div style={{ fontSize: 13.5, color: COLORS.sub }}>
                {signed
                  ? `Confirmed ${fmt(record.confirmedAt)} · your initials ${record.studentInitials} · ${record.parentRelationship.toLowerCase()} ${record.parentName} (${record.parentInitials}) · version ${record.versionLabel || AGREEMENT_VERSION_LABEL}`
                  : `You signed on ${fmt(record.studentSignedAt || record.acceptedAt)}. We emailed ${record.parentEmailMasked}${record.lastSentAt ? ` on ${fmt(record.lastSentAt)}` : ""} with a confirmation link. Your lessons open once they click it.`}
              </div>
            </div>
          </div>
          {!signed && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13.5, color: COLORS.sub, lineHeight: 1.55 }}>
                Ask your {record.parentRelationship.toLowerCase()} to check their inbox (and the spam folder) for an email from EIB. The link works for 7 days.
              </div>
              {resendMsg && <Notice tone={resendMsg.ok ? "info" : "error"} onClose={() => setResendMsg(null)}>{resendMsg.text}</Notice>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button type="button" onClick={resend} disabled={resending || waitMin > 0} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: resending || waitMin > 0 ? "#d7dbe4" : COLORS.indigo, color: resending || waitMin > 0 ? COLORS.faint : "#fff", fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "11px 18px", cursor: resending || waitMin > 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                  <Mail size={16} /> {resending ? "Sending…" : "Resend the confirmation email"}
                </button>
                {waitMin > 0 && <span style={{ fontSize: 12.5, color: COLORS.faint }}>Available again in {waitMin} min</span>}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            {signed && (
              <a href="/lessons" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "11px 18px", textDecoration: "none" }}>
                Open your lessons <ArrowRight size={16} />
              </a>
            )}
            {meta.pdf && (
              <a href="/api/agreement/pdf?download=1" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "11px 18px", textDecoration: "none" }}>
                <Download size={16} /> Download the PDF
              </a>
            )}
          </div>
        </Card>
      </Shell>
    );
  }

  if (!meta.pdf) {
    return (
      <Shell>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text }}>{meta.title}</div>
          <div style={{ fontSize: 14, color: COLORS.sub, marginTop: 6 }}>{preview ? "No PDF has been uploaded yet. Upload one in Student Manager → Forms → Student agreement." : "There is nothing to sign right now."}</div>
          {!preview && <a href="/lessons" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, color: COLORS.indigo, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>Open your lessons <ArrowRight size={15} /></a>}
        </Card>
      </Shell>
    );
  }

  const box = { ...fieldStyle, padding: "10px 12px", fontSize: 14.5, borderRadius: 10 };
  const label = { fontSize: 12, fontWeight: 800, color: COLORS.sub, letterSpacing: 0.3, marginBottom: 6, display: "block" };

  return (
    <Shell>
      {preview && (
        <Notice tone="info">Preview: this is what a student sees before their lessons open. Only a student can sign.</Notice>
      )}
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.indigoSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={22} color={COLORS.indigo} strokeWidth={2.25} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: COLORS.text, margin: 0 }}>{meta.title}</h1>
              <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 2 }}>Hi {user.name.split(" ")[0]}. Your lessons open once this is signed.</div>
            </div>
          </div>
          <a href="/api/agreement/pdf?download=1" onClick={() => setOpenedPdf(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 14px", textDecoration: "none" }}>
            <Download size={15} /> Download as PDF
          </a>
        </div>
        {meta.intro && <p style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6, margin: "16px 0 0" }}>{meta.intro}</p>}
      </Card>

      <section aria-label="The agreement" style={{ margin: "16px 0" }}>
        <PdfReader src="/api/agreement/pdf" onReachEnd={() => setReachedEnd(true)} onError={() => setViewerFailed(true)} />
      </section>

      <section aria-labelledby="s13" style={{ margin: "0 0 16px" }}>
        <Card>
          <h2 id="s13" style={{ fontSize: 17, fontWeight: 900, color: COLORS.text, margin: "0 0 10px" }}>{SECTION_13.heading}</h2>
          <p style={{ fontSize: 14.5, color: COLORS.text, lineHeight: 1.6, margin: "0 0 14px" }}>{SECTION_13.intro}</p>
          {SECTION_13.parts.map((part) => (
            <div key={part.title} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{part.title}</div>
              {part.items ? (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, color: COLORS.text, lineHeight: 1.6 }}>
                  {part.items.map((t) => <li key={t}>{t}</li>)}
                </ul>
              ) : (
                <p style={{ fontSize: 14.5, color: COLORS.text, lineHeight: 1.6, margin: 0 }}>{part.text}</p>
              )}
            </div>
          ))}
        </Card>
      </section>

      <Card>
        <form onSubmit={submit} aria-describedby="sign-hint" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div id="sign-hint" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: canSign ? COLORS.green : COLORS.amber, background: canSign ? COLORS.greenSoft : COLORS.amberSoft, border: `1px solid ${canSign ? COLORS.greenBorder : COLORS.amberBorder}`, borderRadius: 12, padding: "10px 14px" }}>
            {canSign ? <CircleCheck size={16} /> : <Lock size={16} />}
            {canSign ? "You've reached the end. You can sign below." : viewerFailed ? "The viewer could not load. Open the PDF with the download button, read it, then sign below." : "Scroll through the whole agreement to unlock the signature section."}
          </div>

          <fieldset disabled={!canSign || preview} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18, opacity: canSign ? 1 : 0.55 }}>
            <legend style={{ fontSize: 15, fontWeight: 900, color: COLORS.text, marginBottom: 4 }}>Student</legend>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: COLORS.text, cursor: "pointer" }}>
              <input type="checkbox" checked={form.readConfirmed} onChange={(e) => set("readConfirmed", e.target.checked)} required style={{ width: 18, height: 18, marginTop: 2 }} />
              <span>I have read and understood this agreement, the EIB syllabus and the EIB MVP Reimbursement Policy. Typing my initials below is my signature.</span>
            </label>
            <div style={{ maxWidth: 240 }}>
              <label htmlFor="student-initials" style={label}>Your initials</label>
              <input id="student-initials" value={form.studentInitials} onChange={(e) => set("studentInitials", e.target.value.toUpperCase())} placeholder="e.g. JM" maxLength={10} autoComplete="off" required style={box} />
              <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 6 }}>Typing your initials here is your signature.</div>
            </div>

            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.text }}>Parent or legal guardian</div>
              <div style={{ fontSize: 13.5, color: COLORS.sub, marginTop: 4, lineHeight: 1.55 }}>
                This part must be completed by your parent or legal guardian, not by you. Hand them the device, or have them beside you while you type what they say.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div>
                <label htmlFor="parent-name" style={label}>Full name</label>
                <input id="parent-name" value={form.parentName} onChange={(e) => set("parentName", e.target.value)} autoComplete="off" required style={box} />
              </div>
              <div>
                <label htmlFor="parent-email" style={label}>Email</label>
                <input id="parent-email" type="email" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} autoComplete="off" required style={box} />
              </div>
              <div>
                <label htmlFor="parent-rel" style={label}>Relationship to the student</label>
                <select id="parent-rel" value={form.parentRelationship} onChange={(e) => set("parentRelationship", e.target.value)} required style={{ ...box, background: "#fff" }}>
                  <option value="">Choose…</option>
                  {(meta.relationships || []).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="parent-initials" style={label}>Their initials</label>
                <input id="parent-initials" value={form.parentInitials} onChange={(e) => set("parentInitials", e.target.value.toUpperCase())} placeholder="e.g. AM" maxLength={10} autoComplete="off" required style={box} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: COLORS.text, cursor: "pointer" }}>
              <input type="checkbox" checked={form.parentConfirmed} onChange={(e) => set("parentConfirmed", e.target.checked)} required style={{ width: 18, height: 18, marginTop: 2 }} />
              <span>I am the parent or legal guardian of {user.name} and I agree to this agreement on their behalf. Typing my initials above is my signature. I will click the confirmation link sent to the email address I provided; the signature is complete only after that.</span>
            </label>
          </fieldset>

          {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

          <button
            type="submit"
            disabled={!canSign || submitting || preview}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", background: canSign && !preview ? COLORS.indigo : "#d7dbe4", color: canSign && !preview ? "#fff" : COLORS.faint, fontWeight: 900, fontSize: 15, borderRadius: 999, padding: "13px 22px", cursor: canSign && !preview ? "pointer" : "default", alignSelf: "flex-start" }}
          >
            <ShieldCheck size={17} /> {submitting ? "Saving…" : "I agree"}
          </button>
          <p style={{ fontSize: 12.5, color: COLORS.faint, lineHeight: 1.6, margin: 0 }}>
            After you press "I agree" we email your guardian a confirmation link; your lessons open once they click it. Their name and email are kept only as the record of this consent (version {AGREEMENT_VERSION_LABEL}). See the <a href="/privacy" style={{ color: COLORS.indigo, fontWeight: 700 }}>Privacy Policy</a>.
          </p>
        </form>
      </Card>
    </Shell>
  );
}

function Shell({ children }) {
  return <div style={{ background: COLORS.bg, minHeight: "100%", padding: "28px 20px 60px" }}><div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div></div>;
}
function Card({ children }) {
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 22 }}>{children}</div>;
}
