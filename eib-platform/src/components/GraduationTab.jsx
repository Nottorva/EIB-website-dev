"use client";

// Student Manager > Graduation (super admin). Each student's deliverable
// progress, and the EIB Founder Micro-Credential: release it to everyone who
// has completed every deliverable, or release / revoke one student at a time.
// Nothing is public before a release, and releasing emails nobody. The
// credential itself is built in lib/data/credentials.js.

import { useEffect, useRef, useState } from "react";
import { Award, BadgeCheck, Ban, Copy, Check, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { COLORS, fieldStyle, useDangerConfirm, Avatar, EmptyState, Notice, Loading, PrimaryButton, Card } from "./ui";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const API = "/api/graduation";
const smallButton = (tone) => ({ border: `1px solid ${tone === "red" ? COLORS.errorBorder : COLORS.border2}`, background: tone === "red" ? COLORS.errorBg : COLORS.bg, color: tone === "red" ? COLORS.errorText : COLORS.ink, fontWeight: 600, fontSize: 12.5, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <button type="button" onClick={copy} style={{ ...smallButton(), display: "inline-flex", alignItems: "center", gap: 6 }}>
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function StatusPill({ credential }) {
  const look = !credential
    ? { label: "Not released", color: COLORS.muted, bg: COLORS.bg, border: COLORS.border }
    : credential.status === "active"
      ? { label: "Active", color: COLORS.successText, bg: COLORS.successBg, border: COLORS.successBorder, icon: BadgeCheck }
      : { label: "Revoked", color: COLORS.errorText, bg: COLORS.errorBg, border: COLORS.errorBorder, icon: Ban };
  const Icon = look.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: look.color, background: look.bg, border: `1px solid ${look.border}`, padding: "4px 10px", whiteSpace: "nowrap" }}>
      {Icon && <Icon size={13} />} {look.label}
    </span>
  );
}

function StudentRow({ s, busy, onRelease, onRevoke }) {
  const c = s.credential;
  const active = c?.status === "active";
  const url = c ? `${window.location.origin}/c/${c.id}` : "";
  return (
    <Card style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Avatar name={s.name} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{s.name}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: s.complete ? COLORS.successText : COLORS.text2, marginTop: 2 }}>
            {s.done} of {s.total} deliverables{s.complete ? " · all complete" : ""}
          </div>
        </div>
        <StatusPill credential={c} />
        {active ? (
          <button type="button" disabled={busy} onClick={onRevoke} style={smallButton("red")}>
            Revoke
          </button>
        ) : s.complete ? (
          <button type="button" disabled={busy} onClick={onRelease} style={smallButton()}>
            {c ? "Release again" : "Release"}
          </button>
        ) : null}
      </div>
      {!s.complete && s.missing.length > 0 && (
        <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 10, lineHeight: 1.55 }}>
          <strong style={{ color: COLORS.text2 }}>Still to complete:</strong> {s.missing.map((m) => `${m.short} ${m.title}`).join(", ")}
        </div>
      )}
      {active && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 12.5, color: COLORS.muted, flex: 1, minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Issued {fmtDate(c.issuedAt)} · {url}
          </span>
          <CopyLinkButton url={url} />
          <a href={url} target="_blank" rel="noreferrer" style={{ ...smallButton(), display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            Open <ExternalLink size={13} />
          </a>
        </div>
      )}
      {c?.status === "revoked" && <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 10 }}>Revoked {fmtDate(c.revokedAt)}. Their link now shows a "Revoked" notice and none of their work.</div>}
    </Card>
  );
}

// What every credential page shows: the criteria, which deliverable is the
// founder story, and which deliverables are public.
function PageSettings({ data, onSave }) {
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState(data.settings.criteria);
  const timer = useRef(null);
  const hidden = new Set(data.settings.hidden);
  const shown = data.deliverables.filter((d) => !hidden.has(d.id)).length;
  const story = data.deliverables.find((d) => d.id === data.settings.storyDeliverableId);

  const typeCriteria = (v) => {
    setCriteria(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave({ criteria: v }), 600);
  };
  const toggle = (id) => onSave({ hidden: hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id] });
  const label = { fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "18px 0 6px" };

  return (
    <Card style={{ marginBottom: 16 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        {open ? <ChevronDown size={16} color={COLORS.muted} /> : <ChevronRight size={16} color={COLORS.muted} />}
        <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>What a credential page shows</span>
        <span style={{ fontSize: 12.5, color: story ? COLORS.muted : COLORS.warnText, fontWeight: 600, marginLeft: "auto", textAlign: "right" }}>
          {story ? `Founder story: ${story.short}` : "No founder story chosen"} · {shown} of {data.deliverables.length} deliverables public
        </span>
      </button>
      {open && (
        <div>
          <div style={label}>Founder story</div>
          <select value={data.settings.storyDeliverableId} onChange={(e) => onSave({ storyDeliverableId: e.target.value })} style={{ ...fieldStyle, padding: "9px 12px", fontSize: 14 }} aria-label="Founder story deliverable">
            <option value="">None (the page has no founder story)</option>
            {data.deliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short} · {d.title} (Lesson {d.lessonNumber})
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>The student's answer to this deliverable is shown as their founder story, above the rest of their work. Add a "Founder Story" deliverable in the Lesson Editor, then pick it here.</div>

          <div style={label}>Criteria</div>
          <textarea value={criteria} onChange={(e) => typeCriteria(e.target.value)} rows={4} style={{ ...fieldStyle, resize: "vertical", fontSize: 14, lineHeight: 1.55 }} aria-label="Criteria" />
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 6 }}>Printed on a credential when it is released. Credentials already released keep the wording they were released with.</div>

          <div style={label}>Deliverables on the public page</div>
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 8, lineHeight: 1.5 }}>Anyone with a student's link can read these. Un-tick anything that should stay private, such as work that names other people. This applies at once to every credential, released or not.</div>
          {data.deliverables.length === 0 ? (
            <div style={{ fontSize: 13.5, color: COLORS.muted, fontStyle: "italic" }}>No published lesson has a deliverable yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.deliverables.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, fontWeight: 600, color: hidden.has(d.id) ? COLORS.muted : COLORS.ink, padding: "5px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={!hidden.has(d.id)} onChange={() => toggle(d.id)} />
                  <span>
                    <strong style={{ color: COLORS.ink }}>{d.short}</strong> · {d.title}
                    {d.id === data.settings.storyDeliverableId ? " (founder story)" : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function GraduationTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDanger, confirmUI] = useDangerConfirm();

  useEffect(() => {
    api.get(API).then(setData).catch((e) => setError(e.message));
  }, []);

  const run = async (fn, done) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setData(next);
      if (done) setInfo(done(next));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div style={{ maxWidth: 720, margin: "0 auto" }}>{error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <Loading />}</div>;

  const complete = data.students.filter((s) => s.complete);
  const ready = complete.filter((s) => !s.credential);
  const active = data.students.filter((s) => s.credential?.status === "active");

  const releaseAll = async () => {
    const ok = await confirmDanger({
      title: `Release ${plural(ready.length, "credential")}?`,
      body: `${ready.map((s) => s.name).join(", ")} ${ready.length === 1 ? "gets" : "each get"} the ${data.title}, with a public page anyone holding the link can open. It appears on their Lessons page. Nobody is emailed.`,
      label: "Release Credentials",
      note: "You can revoke any of them later",
    });
    if (ok) run(() => api.post(API, { action: "releaseAll" }), (next) => (next.released.length ? `Released: ${next.released.join(", ")}.` : "Nobody new to release."));
  };
  const releaseOne = async (s) => {
    const again = Boolean(s.credential);
    const ok = await confirmDanger({
      title: again ? `Release ${s.name}'s credential again?` : `Release a credential to ${s.name}?`,
      body: again ? "Their old link works again and shows their work as it is now. Nobody is emailed." : `${s.name} gets the ${data.title}, with a public page anyone holding the link can open. It appears on their Lessons page. Nobody is emailed.`,
      label: again ? "Release again" : "Release",
      note: "You can revoke it later",
    });
    if (ok) run(() => api.post(API, { action: "release", studentId: s.id }), () => `Released: ${s.name}.`);
  };
  const revokeOne = async (s) => {
    const ok = await confirmDanger({ title: `Revoke ${s.name}'s credential?`, body: 'Their link stays up but shows a "Revoked" notice with none of their work, and the card disappears from their Lessons page. Anything they added to LinkedIn will lead to that notice.', label: "Revoke", note: "You can release it again later" });
    if (ok) run(() => api.post(API, { action: "revoke", studentId: s.id }), () => `Revoked: ${s.name}.`);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {confirmUI}
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {info && (
        <Notice tone="info" onClose={() => setInfo(null)}>
          {info}
        </Notice>
      )}

      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 17, fontWeight: 600, color: COLORS.ink }}>
              <Award size={19} color={COLORS.ink} /> {data.title}
            </div>
            <div style={{ fontSize: 13.5, color: COLORS.text2, marginTop: 6, lineHeight: 1.55 }}>
              Cohort {data.cohort} · {complete.length} of {plural(data.students.length, "student")} completed all {plural(data.deliverables.length, "deliverable")} · {active.length} released
            </div>
          </div>
          <PrimaryButton icon={Award} onClick={releaseAll} disabled={busy || ready.length === 0}>
            Release Credentials{ready.length ? ` (${ready.length})` : ""}
          </PrimaryButton>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 12, lineHeight: 1.55 }}>
          A deliverable is complete when every field is filled: text written, a working link, every checklist box ticked, every table cell filled. Release Credentials gives one to every student who has completed them all and does not have one yet. Nothing is public before that, and nobody is emailed: the student sees it on their Lessons page, and you can copy any link below.
        </div>
        {!data.linkedInOrgSet && <div style={{ fontSize: 12.5, color: COLORS.warnText, fontWeight: 600, marginTop: 8, lineHeight: 1.55 }}>The LinkedIn company page number (LINKEDIN_ORG_ID) is not set, so "Add to LinkedIn" names the issuer as plain text instead of linking to the company page.</div>}
      </Card>

      <PageSettings data={data} onSave={(patch) => run(() => api.patch(API, patch))} />

      {data.students.length === 0 ? <EmptyState>No students in the class yet.</EmptyState> : data.students.map((s) => <StudentRow key={s.id} s={s} busy={busy} onRelease={() => releaseOne(s)} onRevoke={() => revokeOne(s)} />)}
    </div>
  );
}
