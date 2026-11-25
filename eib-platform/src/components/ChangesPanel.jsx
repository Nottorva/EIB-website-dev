"use client";

// /changes (super admin): tickets the assistant proposed. Each one lists the exact edits (platform records and
// document spots) with before and after; Approve applies them all, Reject drops them and tells the requester.

import { useEffect, useState } from "react";
import { ClipboardCheck, Check, X, FileText, Database, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { COLORS, PageTitle, Card, Notice, Loading, PrimaryButton, SectionLabel, EmptyState } from "./ui";
import { api } from "@/lib/api";
import { fmtShortDateTime } from "@/lib/format";

const STATUS = {
  proposed: { label: "Waiting for your approval", color: COLORS.warnText, bg: COLORS.warnBg, border: COLORS.warnBorder },
  applied: { label: "Applied", color: COLORS.successText, bg: COLORS.successBg, border: COLORS.successBorder },
  "partly applied": { label: "Partly applied", color: COLORS.warnText, bg: COLORS.warnBg, border: COLORS.warnBorder },
  failed: { label: "Could not apply", color: COLORS.errorText, bg: COLORS.errorBg, border: COLORS.errorBorder },
  rejected: { label: "Rejected", color: COLORS.muted, bg: COLORS.bg, border: COLORS.border },
  draft: { label: "Awaiting the requester's confirmation", color: COLORS.text2, bg: COLORS.bg, border: COLORS.border },
  withdrawn: { label: "Withdrawn by the requester", color: COLORS.muted, bg: COLORS.bg, border: COLORS.border },
  superseded: { label: "Replaced by a corrected proposal", color: COLORS.muted, bg: COLORS.bg, border: COLORS.border },
  expired: { label: "Expired", color: COLORS.muted, bg: COLORS.bg, border: COLORS.border },
};

function Step({ s }) {
  const Icon = s.kind === "document" ? FileText : Database;
  const tone = s.status === "done" ? COLORS.successText : s.status === "failed" ? COLORS.errorText : s.status === "skipped" ? COLORS.muted : COLORS.ink;
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
      <Icon size={16} color={tone} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 14, color: COLORS.ink }}>
        <div style={{ fontWeight: 600 }}>
          {s.n}. {s.description}
          {s.link ? (
            <a href={s.link} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: COLORS.ink, fontWeight: 600, fontSize: 13 }}>
              open <ExternalLink size={12} style={{ verticalAlign: "-1px" }} />
            </a>
          ) : null}
        </div>
        {s.status !== "skipped" && (s.before !== "" || s.after !== "") ? (
          <div style={{ fontSize: 13.5, color: COLORS.text2, marginTop: 4 }}>
            <div>
              <span style={{ color: COLORS.muted }}>Before:</span> {s.before || "(blank)"}
            </div>
            <div>
              <span style={{ color: COLORS.muted }}>After:</span> {s.after || "(blank)"}
              {s.count > 1 ? ` (${s.count} places)` : ""}
            </div>
          </div>
        ) : null}
        {s.note ? <div style={{ fontSize: 13, color: COLORS.warnText, marginTop: 4 }}>Note: {s.note}</div> : null}
        {s.status === "skipped" ? <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Not possible: {s.problem}</div> : null}
        {s.status === "done" ? <div style={{ fontSize: 13, color: COLORS.successText, marginTop: 4 }}>Done: {s.result}</div> : null}
        {s.status === "failed" ? <div style={{ fontSize: 13, color: COLORS.errorText, marginTop: 4 }}>Failed: {s.problem}</div> : null}
      </div>
    </div>
  );
}

function Ticket({ t, busy, onDecide }) {
  const [open, setOpen] = useState(t.status === "proposed");
  const st = STATUS[t.status] || STATUS.expired;
  const who = t.requester?.kind === "josef" ? "you" : `${t.requester?.name || t.requester?.email || "someone"}${t.requester?.email ? ` (${t.requester.email})` : ""}`;
  return (
    <Card style={{ padding: "18px 22px", marginBottom: 12, border: `1px solid ${st.border}` }} id={`C-${t.shortId}`}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse" : "Expand"} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: COLORS.muted }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink }}>{t.summary}</div>
          <div style={{ fontSize: 13, color: COLORS.text2, marginTop: 3 }}>
            C-{t.shortId} · asked by {who} · {fmtShortDateTime(t.createdAt)}
            {t.decidedAt ? ` · decided ${fmtShortDateTime(t.decidedAt)}` : t.expiresAt ? ` · expires ${fmtShortDateTime(t.expiresAt)}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.border}`, padding: "4px 10px" }}>{st.label}</span>
      </div>
      {open ? (
        <div style={{ marginTop: 12 }}>
          {t.steps.map((s) => (
            <Step key={s.n} s={s} />
          ))}
          {t.notes ? <div style={{ fontSize: 13.5, color: COLORS.warnText, marginTop: 10 }}>Also for you to check: {t.notes}</div> : null}
          {t.rejectReason ? <div style={{ fontSize: 13.5, color: COLORS.text2, marginTop: 10 }}>Reason: {t.rejectReason}</div> : null}
          {t.status === "proposed" ? (
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <PrimaryButton icon={Check} disabled={busy} onClick={() => onDecide(t, "approve")}>
                Approve and apply
              </PrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(t, "reject")}
                style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.errorText, fontWeight: 600, fontSize: 14, padding: "9px 16px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}
              >
                <X size={15} /> Reject
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function ChangesPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const load = () => api.get("/api/agent/changes").then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Loading />;

  const decide = async (t, decision, reason = "") => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.put("/api/agent/changes", { id: t.id, decision, reason });
      setData(r);
      if (r.message) setNote(r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const waiting = data.changes.filter((c) => c.status === "proposed");
  const history = data.changes.filter((c) => c.status !== "proposed");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "30px 20px 60px" }}>
      <PageTitle title="Proposed changes" style={{ maxWidth: "none" }} right={<span style={{ fontSize: 14, color: COLORS.text2 }}>Tickets the assistant wrote up. Nothing changes until you approve.</span>} />
      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {note ? (
        <Notice tone="info" onClose={() => setNote(null)}>
          {note}
        </Notice>
      ) : null}

      <SectionLabel style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ClipboardCheck size={15} /> Waiting for you ({waiting.length})
      </SectionLabel>
      {!waiting.length ? <EmptyState>Nothing waiting. When someone asks the assistant for a change, the ticket shows here and you get an email.</EmptyState> : null}
      {waiting.map((t) => (
        <Ticket key={t.id} t={t} busy={busy} onDecide={decide} />
      ))}

      <button type="button" onClick={() => setShowHistory((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", color: COLORS.action, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 24, marginBottom: 10 }}>
        {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />} History ({history.length}; proposed tickets expire after {data.expiryDays} days)
      </button>
      {showHistory ? history.map((t) => <Ticket key={t.id} t={t} busy={busy} onDecide={decide} />) : null}
    </div>
  );
}
