"use client";

// Student Manager > Reminders (super admin). Deliverables are due the Thursday
// after their lesson. This tab shows who has unfinished work that is past due,
// the email they get, a switch for sending it automatically, and
// a button to send it now. The rules are in lib/data/reminders.js.

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { COLORS, SegmentedTabs, useDangerConfirm, Avatar, EmptyState, Notice, Loading, PrimaryButton, Card, Section, FieldLabel } from "./ui";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { formatDue } from "@/lib/deliverables";

const API = "/api/reminders";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function DueChip({ kind, children }) {
  const look = kind === "past"
    ? { color: COLORS.errorText, bg: COLORS.errorBg, border: COLORS.errorBorder }
    : kind === "today"
      ? { color: COLORS.warnText, bg: COLORS.warnBg, border: COLORS.warnBorder }
      : kind === "done"
        ? { color: COLORS.successText, bg: COLORS.successBg, border: COLORS.successBorder }
        : { color: COLORS.text2, bg: COLORS.bg, border: COLORS.border };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: look.color, background: look.bg, border: `1px solid ${look.border}`, padding: "3px 10px", whiteSpace: "nowrap" }}>{children}</span>;
}

export default function RemindersTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [confirm, confirmUI] = useDangerConfirm();

  useEffect(() => {
    api.get(API).then(setData).catch((e) => setError(e.message));
  }, []);

  const run = async (call) => {
    setBusy(true);
    setError(null);
    try {
      const next = await call();
      setData(next);
      return next;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const setEnabled = (id) => run(() => api.patch(API, { enabled: id === "on" }));
  const sendNow = async () => {
    const n = data.students.length;
    if (!(await confirm({ title: `Email ${plural(n, "student")} now?`, body: "Each one gets the email below, listing their own past-due deliverables. Students who were already reminded get it again.", label: "Send the emails", note: "This emails students" }))) return;
    setDone(null);
    const next = await run(() => api.post(API, { action: "send" }));
    if (next) setDone(next.result);
  };

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirmUI}
      {error && <Notice onClose={() => setError(null)} style={{ marginBottom: 0 }}>{error}</Notice>}
      {done && (
        <Notice tone={done.failed.length ? "amber" : "success"} onClose={() => setDone(null)} style={{ marginBottom: 0 }} lead={`Sent to ${plural(done.sent.length, "student")}.`}>
          {done.failed.length > 0 && `Could not send to ${done.failed.map((f) => f.name).join(", ")}: ${done.failed[0].error}`}
        </Notice>
      )}
      {!data.emailReady && (
        <Notice tone="amber" style={{ marginBottom: 0 }} lead="Email is not set up on this copy of the site.">
          Nothing is really sent here: each email is written to the file data/outbox.jsonl instead.
        </Notice>
      )}

      <Section eyebrow="Due dates" title="Deliverable reminders">
        <p style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6, margin: "0 0 20px", maxWidth: "68ch" }}>
          Every lesson's deliverables are due on the Thursday after the lesson, using the lesson's date. A lesson with no date has no due date. Students see the due date, and what is past due, on their Lessons page. The email only goes to a student who still has an empty field in a deliverable after its Thursday has passed.
        </p>
        <FieldLabel>Automatic emails</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <SegmentedTabs value={data.enabled ? "on" : "off"} onChange={(id) => !busy && setEnabled(id)} options={[{ id: "off", label: "Off" }, { id: "on", label: "On" }]} style={{ width: 200 }} />
          <span style={{ fontSize: 14, color: COLORS.text2, flex: "1 1 300px", lineHeight: 1.55 }}>
            {data.enabled
              ? `On. The morning after each Thursday due date, a student who has not finished that chapter gets one email listing everything of theirs that is past due. A chapter never sets off a second email. ${data.classStarted ? `The next morning run would email ${plural(data.nextAutomatic, "student")} as things stand.` : "Nothing is sent while the class is on hold."}`
              : "Off. Nothing is sent unless you press the Send button below."}
          </span>
        </div>
      </Section>

      <Section eyebrow="Right now" title={data.students.length ? `${plural(data.students.length, "student")} with past-due work` : "Nobody has past-due work"}>
        {data.students.length === 0 ? (
          <EmptyState>Every deliverable whose Thursday has passed is done.</EmptyState>
        ) : (
          <>
            {data.students.map((s) => (
              <Card key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Avatar name={s.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{s.name}</div>
                    <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>{s.email}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {s.items.map((it) => (
                        <div key={it.short} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: COLORS.text2 }}>
                          <DueChip kind="past">Past due</DueChip>
                          <span><strong style={{ color: COLORS.ink, fontWeight: 600 }}>{it.short}</strong> {it.title}</span>
                          <span style={{ color: COLORS.muted, fontSize: 13 }}>{it.chapter} · was due {formatDue(it.due)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <PrimaryButton icon={Send} onClick={sendNow} disabled={busy} style={{ marginTop: 16 }}>
              {busy ? "Working…" : `Send the reminder to ${plural(data.students.length, "student")} now`}
            </PrimaryButton>
          </>
        )}
      </Section>

      <Section eyebrow="The email" title={data.sample.example ? "What a student would get" : `What ${data.students[0].name} would get`}>
        <FieldLabel>Subject</FieldLabel>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 16 }}>{data.sample.subject}</div>
        <FieldLabel>Message</FieldLabel>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "18px 20px" }}>
          <Mail size={18} color={COLORS.muted} style={{ flexShrink: 0, marginTop: 3 }} />
          <div style={{ fontSize: 15, color: COLORS.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", minWidth: 0, overflowWrap: "anywhere" }}>{data.sample.text}</div>
        </div>
      </Section>

      {data.recent.length > 0 && (
        <Section eyebrow="History" title="Recent reminders">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.recent.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, color: COLORS.text2, borderBottom: `1px solid ${COLORS.border}`, padding: "6px 0" }}>
                <span style={{ color: COLORS.ink, fontWeight: 500 }}>{r.name}</span>
                <span>{fmtDateTime(r.sentAt)} · {r.manual ? "sent by you" : "automatic"}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
