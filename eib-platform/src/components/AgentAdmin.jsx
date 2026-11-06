"use client";

// /agent (super admin): the EIB Email Agent's control panel. Who may email it, what it has been asked,
// what is waiting on Josef, the FAQ it has learned, and whether each service is connected.

import React, { useEffect, useState } from "react";
import { Bot, Plus, Trash2, CircleCheck, Circle, Mail, Inbox, BookOpen, Users } from "lucide-react";
import { COLORS, PageTitle, Card, fieldStyle, Notice, Loading, PrimaryButton, IconButton, SectionLabel, EmptyState } from "./ui";
import { api } from "@/lib/api";
import { fmtShortDateTime } from "@/lib/format";

function Dot({ ok, label, hint }) {
  const Icon = ok ? CircleCheck : Circle;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: ok ? COLORS.text : COLORS.faint }}>
      <Icon size={16} color={ok ? COLORS.green : COLORS.faint} />
      <span style={{ fontWeight: 700 }}>{label}</span>
      {!ok && hint ? <span style={{ color: COLORS.faint }}>· {hint}</span> : null}
    </div>
  );
}

function Section({ icon: Icon, title, children, right }) {
  return (
    <Card style={{ padding: 26, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <SectionLabel style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={15} /> {title}
        </SectionLabel>
        {right}
      </div>
      {children}
    </Card>
  );
}

export default function AgentAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [grant, setGrant] = useState("");
  const [grantName, setGrantName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = () => api.get("/api/agent/admin").then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Loading />;

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      setData(r);
      if (r.message) setNote(r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const c = data.config;
  const open = data.escalations.filter((e) => e.status === "open");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "30px 20px 60px" }}>
      <PageTitle title="EIB Assistant" style={{ maxWidth: "none" }} right={c.address ? <span style={{ fontSize: 14, color: COLORS.sub }}>Email it at <strong style={{ color: COLORS.text }}>{c.address}</strong></span> : null} />
      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {note ? (
        <Notice tone="info" onClose={() => setNote(null)}>
          {note}
        </Notice>
      ) : null}

      <Section icon={Bot} title="Connections">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          <Dot ok={Boolean(c.address)} label="Agent address" hint="AGENT_ADDRESS" />
          <Dot ok={c.resend} label="Resend sending" hint="RESEND_API_KEY" />
          <Dot ok={c.webhookSecret} label="Resend inbound webhook" hint="RESEND_WEBHOOK_SECRET" />
          <Dot ok={c.anthropic} label={`Claude (${c.model})`} hint="ANTHROPIC_API_KEY; mock answers until set" />
          <Dot ok={c.drive} label="EIB Documents folder" hint="GOOGLE_SERVICE_ACCOUNT_JSON + EIB_DRIVE_FOLDER_ID" />
          <Dot ok={c.readUser} label="Read-only database user" hint="MONGODB_AGENT_READ_URI (main database used)" />
          <Dot ok={c.writeUser} label="Write database user" hint="MONGODB_AGENT_WRITE_URI (main database used)" />
          <Dot ok={c.cron} label="Daily reminder" hint="CRON_SECRET" />
        </div>
        <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 14 }}>
          Only mail that passes authentication from {c.josefAddresses.join(", ")} can change data. Everyone below can ask questions.
        </div>
      </Section>

      <Section icon={Users} title="Who can email the assistant">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.access.envDomains.map((d) => (
            <Row key={`ed-${d}`} label={`Everyone at @${d}`} sub="set on Vercel (TFS_WHITELIST_DOMAINS)" />
          ))}
          {data.access.envAddresses.map((e) => (
            <Row key={`ea-${e}`} label={e} sub="set on Vercel (TFS_WHITELIST_ADDRESSES)" />
          ))}
          {data.access.domains.map((d) => (
            <Row key={`d-${d.domain}`} label={`Everyone at @${d.domain}`} sub={`added ${fmtShortDateTime(d.addedAt)}`} onRemove={() => act(() => api.put("/api/agent/admin", { revoke: d.domain }))} />
          ))}
          {data.access.addresses.map((a) => (
            <Row key={`a-${a.email}`} label={a.name ? `${a.name} · ${a.email}` : a.email} sub={`added ${fmtShortDateTime(a.addedAt)}${a.addedBy ? ` by ${a.addedBy}` : ""}`} onRemove={() => act(() => api.put("/api/agent/admin", { revoke: a.email }))} />
          ))}
          {!data.access.allDomains.length && !data.access.allAddresses.length ? <EmptyState>Nobody yet. Add an address or a whole domain.</EmptyState> : null}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!grant.trim()) return;
            act(() => api.put("/api/agent/admin", { grant: grant.trim(), name: grantName.trim() })).then(() => {
              setGrant("");
              setGrantName("");
            });
          }}
          style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}
        >
          <input value={grant} onChange={(e) => setGrant(e.target.value)} placeholder="email address or domain (tfs.ca)" aria-label="Email address or domain" style={{ ...fieldStyle, flex: 2, minWidth: 220, padding: "10px 14px" }} />
          <input value={grantName} onChange={(e) => setGrantName(e.target.value)} placeholder="name (optional)" aria-label="Name" style={{ ...fieldStyle, flex: 1, minWidth: 140, padding: "10px 14px" }} />
          <PrimaryButton type="submit" icon={Plus} disabled={busy || !grant.trim()}>
            Give access
          </PrimaryButton>
        </form>
        <div style={{ fontSize: 13, color: COLORS.sub, marginTop: 10 }}>By email: &ldquo;who has agent access?&rdquo;, &ldquo;give name@tfs.ca access&rdquo;, &ldquo;remove access from name@tfs.ca&rdquo;.</div>
      </Section>

      <Section icon={Inbox} title={`Waiting on you (${open.length})`}>
        {!open.length ? <EmptyState>Nothing open. Escalations show here until you reply to their [EIB Q-id] email.</EmptyState> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {open.map((e) => (
            <div key={e.id} style={{ border: `1px solid ${COLORS.amberBorder}`, background: COLORS.amberSoft, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.amber }}>
                [EIB Q-{e.shortId}] · {e.askerName || e.askerEmail} · {fmtShortDateTime(e.createdAt)}
              </div>
              <div style={{ fontSize: 14, color: COLORS.text, marginTop: 4, whiteSpace: "pre-wrap" }}>{e.question}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={BookOpen} title={`Answers it has learned (${data.faq.length})`}>
        {!data.faq.length ? <EmptyState>When you answer an escalation, the question and your answer are saved here and reused.</EmptyState> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.faq.map((f) => (
            <div key={f.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{f.question}</div>
                <div style={{ fontSize: 14, color: COLORS.sub, marginTop: 4, whiteSpace: "pre-wrap" }}>{f.answer}</div>
                <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 6 }}>
                  asked by {f.askedBy} · {fmtShortDateTime(f.createdAt)}
                </div>
              </div>
              <IconButton icon={Trash2} title="Forget this answer" color={COLORS.red} onClick={() => act(() => api.del(`/api/agent/admin?faq=${encodeURIComponent(f.id)}`))} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Mail} title="Recent threads">
        {!data.threads.length ? <EmptyState>No email yet.</EmptyState> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.threads.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 13.5, padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
              <span style={{ color: COLORS.faint, minWidth: 110 }}>{fmtShortDateTime(t.updatedAt)}</span>
              <span style={{ fontWeight: 800, color: COLORS.text, flex: 1, minWidth: 180 }}>{t.subject || "(no subject)"}</span>
              <span style={{ color: COLORS.sub }}>{t.lastFrom}</span>
              <span style={{ color: t.senderKind === "josef" ? COLORS.indigo : t.senderKind === "tfs" ? COLORS.green : COLORS.amber, fontWeight: 700 }}>{t.senderKind || t.mode}</span>
              <span style={{ color: COLORS.faint }}>{t.lastOutcome}</span>
              {t.draft ? <span style={{ color: COLORS.amber }}>pending: {t.draft}</span> : null}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Row({ label, sub, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{label}</div>
        <div style={{ fontSize: 12, color: COLORS.faint }}>{sub}</div>
      </div>
      {onRemove ? <IconButton icon={Trash2} title="Remove access" color={COLORS.red} onClick={onRemove} /> : null}
    </div>
  );
}
