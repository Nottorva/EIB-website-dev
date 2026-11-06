"use client";

// Mentor CRM, Memory tab (super admin): what the EIB Assistant remembers. One line per topic, grouped by
// status with "waiting" first; inline edits; history; topics done for 60 days collapse into Archived.

import React, { useEffect, useState } from "react";
import { Plus, Trash2, History, ChevronDown, ChevronRight, Brain } from "lucide-react";
import { COLORS, Card, fieldStyle, Notice, Loading, PrimaryButton, IconButton, SectionLabel, EmptyState } from "./ui";
import { api } from "@/lib/api";
import { fmtShortDateTime } from "@/lib/format";

const STATUS_STYLE = {
  waiting: { color: COLORS.amber, bg: COLORS.amberSoft, border: COLORS.amberBorder, label: "Waiting" },
  info: { color: COLORS.indigo, bg: COLORS.indigoSoft, border: COLORS.indigoBorder, label: "Info" },
  done: { color: COLORS.green, bg: COLORS.greenSoft, border: COLORS.greenBorder, label: "Done" },
};

function StatusSelect({ value, onChange }) {
  const s = STATUS_STYLE[value] || STATUS_STYLE.info;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Status" style={{ border: `1px solid ${s.border}`, background: s.bg, color: s.color, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "4px 10px", fontFamily: "inherit" }}>
      {Object.entries(STATUS_STYLE).map(([id, st]) => (
        <option key={id} value={id}>
          {st.label}
        </option>
      ))}
    </select>
  );
}

function Row({ item, onPatch, onDelete }) {
  const [topic, setTopic] = useState(item.topic);
  const [summary, setSummary] = useState(item.summary);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    setTopic(item.topic);
    setSummary(item.summary);
  }, [item.topic, item.summary]);
  const commit = (field, value) => {
    if (value === item[field]) return;
    onPatch(item.id, { [field]: value });
  };
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} onBlur={() => commit("topic", topic.trim())} aria-label="Topic" style={{ ...fieldStyle, flex: 1, minWidth: 160, padding: "8px 10px", fontWeight: 800 }} />
        <StatusSelect value={item.status} onChange={(v) => onPatch(item.id, { status: v })} />
        <IconButton icon={History} title="History" onClick={() => setShowHistory((v) => !v)} color={item.history?.length ? COLORS.sub : COLORS.border} disabled={!item.history?.length} />
        <IconButton icon={Trash2} title="Delete" color={COLORS.red} onClick={() => onDelete(item)} />
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => commit("summary", summary.trim())} rows={2} aria-label="Summary" style={{ ...fieldStyle, marginTop: 8, padding: "8px 10px", resize: "vertical" }} />
      <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 6 }}>
        Updated {fmtShortDateTime(item.updatedAt)} by {item.updatedBy === "web" ? "you, on the website" : "email"} · last used {fmtShortDateTime(item.lastUsedAt)}
        {item.sourceEmailId ? (
          <>
            {" · "}
            <a href={`https://resend.com/emails/receiving/${encodeURIComponent(item.sourceEmailId)}`} target="_blank" rel="noreferrer" style={{ color: COLORS.indigo }}>
              source email
            </a>
          </>
        ) : null}
      </div>
      {showHistory && item.history?.length ? (
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {[...item.history].reverse().map((h, i) => (
            <div key={i} style={{ fontSize: 12.5, color: COLORS.sub }}>
              <span style={{ color: COLORS.faint }}>{fmtShortDateTime(h.at)}</span> · {STATUS_STYLE[h.status]?.label || h.status} · {h.summary}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function MemoryTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ topic: "", status: "info", summary: "" });
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/agent/memory").then(setData).catch((e) => setError(e.message));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Loading />;

  const live = data.items.filter((m) => !m.archived);
  const archived = data.items.filter((m) => m.archived);
  const groups = ["waiting", "info", "done"].map((status) => ({ status, items: live.filter((m) => m.status === status) })).filter((g) => g.items.length);
  const onPatch = (id, patch) => run(() => api.patch("/api/agent/memory", { id, ...patch }));
  const onDelete = (item) => {
    if (!confirm(`Forget "${item.topic}"?`)) return;
    run(() => api.del(`/api/agent/memory?id=${encodeURIComponent(item.id)}`));
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 60px" }}>
      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      <Card style={{ padding: 22, marginBottom: 18 }}>
        <SectionLabel style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Brain size={15} /> What the assistant remembers
        </SectionLabel>
        <div style={{ fontSize: 13.5, color: COLORS.sub, marginTop: 6, lineHeight: 1.5 }}>
          One line per topic. The assistant updates these from your emails (or when you write &ldquo;remember: &hellip;&rdquo; and &ldquo;forget: &hellip;&rdquo;) and uses them in every reply. Edit anything inline; changes save when you click away. A topic nobody has used for {data.deleteAfterDays} days is deleted; every update, edit, or answer that draws on it starts the clock again.
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.topic.trim()) return;
            run(() => api.post("/api/agent/memory", draft)).then(() => setDraft({ topic: "", status: "info", summary: "" }));
          }}
          style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}
        >
          <input value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} placeholder="Topic, e.g. Billing 2027" aria-label="New topic" style={{ ...fieldStyle, flex: 1, minWidth: 160, padding: "9px 12px" }} />
          <StatusSelect value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} />
          <input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="One line" aria-label="New summary" style={{ ...fieldStyle, flex: 2, minWidth: 220, padding: "9px 12px" }} />
          <PrimaryButton type="submit" icon={Plus} disabled={busy || !draft.topic.trim()}>
            Add
          </PrimaryButton>
        </form>
      </Card>

      {!live.length ? <EmptyState>Nothing remembered yet.</EmptyState> : null}
      {groups.map((g) => (
        <div key={g.status} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: STATUS_STYLE[g.status].color, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            {STATUS_STYLE[g.status].label} ({g.items.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((m) => (
              <Row key={m.id} item={m} onPatch={onPatch} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}

      {archived.length ? (
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={() => setShowArchived((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", color: COLORS.faint, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Archived ({archived.length}, done for {data.archiveAfterDays}+ days)
          </button>
          {showArchived ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, opacity: 0.8 }}>
              {archived.map((m) => (
                <Row key={m.id} item={m} onPatch={onPatch} onDelete={onDelete} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
