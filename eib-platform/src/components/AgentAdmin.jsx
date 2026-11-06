"use client";

// /agent (super admin): the EIB Email Agent's control panel. Who may email it, what it has been asked,
// the memory counts, recent threads, and whether each service is connected. Escalations are not listed: each one is emailed to Josef.

import React, { useEffect, useState } from "react";
import { Bot, Plus, Trash2, CircleCheck, Circle, Mail, BookOpen, Users } from "lucide-react";
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
        {c.josefAddresses.slice(1).map((addr) => {
          const on = (data.testColleagues || []).find((t) => t.email === addr);
          return (
            <label key={addr} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, padding: "10px 12px", borderRadius: 10, border: `1px solid ${on ? COLORS.amberBorder : COLORS.border}`, background: on ? COLORS.amberSoft : "transparent", cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(on)} disabled={busy} onChange={(e) => act(() => api.put("/api/agent/admin", { testColleague: addr, on: e.target.checked }))} style={{ marginTop: 3 }} />
              <span style={{ fontSize: 13.5, color: COLORS.text }}>
                <strong>Treat {addr} as a colleague for testing.</strong> While ticked, mail from it gets answers only: no edits, no memory changes, no student contact details, and its replies on a thread the assistant wrote are passed to you.
                {on ? ` On until ${fmtShortDateTime(on.until)}, then it counts as you again by itself.` : ` It switches itself back after ${data.testColleagueHours} hours.`}
              </span>
            </label>
          );
        })}
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

      <Section icon={BookOpen} title="Memory">
        <div style={{ fontSize: 14, color: COLORS.text }}>
          {data.memory.total} topic{data.memory.total === 1 ? "" : "s"} remembered, {data.memory.waiting} waiting on someone, {data.memory.archived} archived.{" "}
          <a href="/crm?tab=memory" style={{ color: COLORS.indigo, fontWeight: 800 }}>
            Open the Memory tab
          </a>{" "}
          to read, edit or add topics. By email: &ldquo;remember: &hellip;&rdquo;, &ldquo;forget: &hellip;&rdquo;, &ldquo;what do you remember about &hellip;?&rdquo;.
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
