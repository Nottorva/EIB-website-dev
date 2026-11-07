"use client";

// /changes (super admin): tickets the assistant proposed. Each one lists the exact edits (platform records and
// document spots) with before and after; Approve applies them all, Reject drops them and tells the requester.

import React, { useEffect, useState } from "react";
import { ClipboardCheck, Check, X, FileText, Database, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { COLORS, PageTitle, Card, Notice, Loading, PrimaryButton, SectionLabel, EmptyState } from "./ui";
import { api } from "@/lib/api";
import { fmtShortDateTime } from "@/lib/format";

const STATUS = {
  proposed: { label: "Waiting for your approval", color: COLORS.amber, bg: COLORS.amberSoft, border: COLORS.amberBorder },
  applied: { label: "Applied", color: COLORS.green, bg: "#ecfdf3", border: "#bbf0cf" },
  "partly applied": { label: "Partly applied", color: COLORS.amber, bg: COLORS.amberSoft, border: COLORS.amberBorder },
  failed: { label: "Could not apply", color: COLORS.red, bg: "#fff1f1", border: "#f5c2c2" },
  rejected: { label: "Rejected", color: COLORS.faint, bg: "#f6f7f9", border: COLORS.border },
  draft: { label: "Awaiting the requester's confirmation", color: COLORS.sub, bg: "#f6f7f9", border: COLORS.border },
  withdrawn: { label: "Withdrawn by the requester", color: COLORS.faint, bg: "#f6f7f9", border: COLORS.border },
  superseded: { label: "Replaced by a corrected proposal", color: COLORS.faint, bg: "#f6f7f9", border: COLORS.border },
  expired: { label: "Expired", color: COLORS.faint, bg: "#f6f7f9", border: COLORS.border },
};

function Step({ s }) {
  const Icon = s.kind === "document" ? FileText : Database;
  const tone = s.status === "done" ? COLORS.green : s.status === "failed" ? COLORS.red : s.status === "skipped" ? COLORS.faint : COLORS.text;
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
      <Icon size={16} color={tone} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 14, color: COLORS.text }}>
        <div style={{ fontWeight: 700 }}>
          {s.n}. {s.description}
          {s.link ? (
            <a href={s.link} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: COLORS.indigo, fontWeight: 700, fontSize: 13 }}>
              open <ExternalLink size={12} style={{ verticalAlign: "-1px" }} />
            </a>
          ) : null}
        </div>
        {s.status !== "skipped" && (s.before !== "" || s.after !== "") ? (
          <div style={{ fontSize: 13.5, color: COLORS.sub, marginTop: 4 }}>
            <div>
              <span style={{ color: COLORS.faint }}>Before:</span> {s.before || "(blank)"}
            </div>
            <div>
              <span style={{ color: COLORS.faint }}>After:</span> {s.after || "(blank)"}
              {s.count > 1 ? ` (${s.count} places)` : ""}
            </div>
          </div>
        ) : null}
        {s.note ? <div style={{ fontSize: 13, color: COLORS.amber, marginTop: 4 }}>Note: {s.note}</div> : null}
        {s.status === "skipped" ? <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 4 }}>Not possible: {s.problem}</div> : null}
        {s.status === "done" ? <div style={{ fontSize: 13, color: COLORS.green, marginTop: 4 }}>Done: {s.result}</div> : null}
        {s.status === "failed" ? <div style={{ fontSize: 13, color: COLORS.red, marginTop: 4 }}>Failed: {s.problem}</div> : null}
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
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse" : "Expand"} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: COLORS.faint }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{t.summary}</div>
          <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 3 }}>
            C-{t.shortId} · asked by {who} · {fmtShortDateTime(t.createdAt)}
            {t.decidedAt ? ` · decided ${fmtShortDateTime(t.decidedAt)}` : t.expiresAt ? ` · expires ${fmtShortDateTime(t.expiresAt)}` : ""}
          </div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: st.color, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: "4px 10px" }}>{st.label}</span>
      </div>
      {open ? (
        <div style={{ marginTop: 12 }}>
          {t.steps.map((s) => (
            <Step key={s.n} s={s} />
          ))}
          {t.notes ? <div style={{ fontSize: 13.5, color: COLORS.amber, marginTop: 10 }}>Also for you to check: {t.notes}</div> : null}
          {t.rejectReason ? <div style={{ fontSize: 13.5, color: COLORS.sub, marginTop: 10 }}>Reason: {t.rejectReason}</div> : null}
          {t.status === "proposed" ? (
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <PrimaryButton icon={Check} disabled={busy} onClick={() => onDecide(t, "approve")}>
                Approve and apply
              </PrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(t, "reject")}
                style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.red, fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "9px 16px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}
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
      <PageTitle title="Proposed changes" style={{ maxWidth: "none" }} right={<span style={{ fontSize: 14, color: COLORS.sub }}>Tickets the assistant wrote up. Nothing changes until you approve.</span>} />
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

      <button type="button" onClick={() => setShowHistory((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", color: COLORS.faint, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 24, marginBottom: 10 }}>
        {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />} History ({history.length}; proposed tickets expire after {data.expiryDays} days)
      </button>
      {showHistory ? history.map((t) => <Ticket key={t.id} t={t} busy={busy} onDecide={decide} />) : null}
    </div>
  );
}
