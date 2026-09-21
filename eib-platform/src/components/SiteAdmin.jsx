"use client";

// Website page (super admin): the public site's ticker strip and the
// testimonials list. Lessons are published from the Lesson Editor instead.

import React, { useEffect, useState } from "react";
import { Globe, Plus, Trash2, ExternalLink, RotateCcw, Quote } from "lucide-react";
import { COLORS, PageTitle, Card, FieldLabel, fieldStyle, Notice, SaveIndicator, Loading, PrimaryButton, IconButton, SectionLabel } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";

const ROLE_SUGGESTIONS = ["Student", "Faculty sponsor", "Mentor", "Head of school", "Showcase panel"];

function OnOff({ value, onChange, onLabel, offLabel }) {
  const btn = (active, label, on) => (
    <button
      type="button"
      onClick={() => onChange(on)}
      style={{
        padding: "7px 12px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: 700,
        cursor: "pointer",
        border: "none",
        background: active ? (on ? COLORS.green : COLORS.indigo) : "transparent",
        color: active ? "#fff" : COLORS.sub,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 3, border: `1px solid ${COLORS.border}`, borderRadius: 11, padding: 3, flexShrink: 0 }}>
      {btn(!value, offLabel, false)}
      {btn(value, onLabel, true)}
    </div>
  );
}

function TickerPanel({ ticker, defaults, onChange }) {
  const set = (i, v) => onChange(ticker.map((t, k) => (k === i ? v : t)));
  const remove = (i) => onChange(ticker.filter((_, k) => k !== i));
  return (
    <Card style={{ padding: 26 }}>
      <SectionLabel style={{ marginBottom: 6 }}>Ticker strip</SectionLabel>
      <div style={{ fontSize: 14, color: COLORS.sub, lineHeight: 1.55, marginBottom: 18 }}>
        The thin strip along the very top of the site. The first item is written for you from the application window
        (open until / opens on / closed); these follow it. Keep them short.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ticker.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={t} onChange={(e) => set(i, e.target.value)} placeholder="Student Showcase on April 23" style={{ ...fieldStyle, padding: "10px 14px" }} />
            <IconButton icon={Trash2} title="Remove" onClick={() => remove(i)} color={COLORS.red} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <PrimaryButton icon={Plus} onClick={() => onChange([...ticker, ""])} disabled={ticker.length >= 12}>
          Add item
        </PrimaryButton>
        <button
          type="button"
          onClick={() => onChange(defaults)}
          style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "9px 14px", cursor: "pointer" }}
        >
          <RotateCcw size={14} /> Reset to defaults
        </button>
      </div>
    </Card>
  );
}

function TestimonialCard({ t, onPatch, onDelete }) {
  return (
    <Card style={{ padding: 22, border: `1px solid ${t.approved ? COLORS.greenBorder : COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.approved ? COLORS.green : COLORS.faint }}>
          {t.approved ? "Live on the site" : "Draft · not shown"}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <OnOff value={Boolean(t.approved)} onChange={(v) => onPatch({ approved: v })} onLabel="Approved" offLabel="Draft" />
          <IconButton icon={Trash2} title="Delete testimonial" onClick={onDelete} color={COLORS.red} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Quote</FieldLabel>
        <textarea value={t.quote} onChange={(e) => onPatch({ quote: e.target.value })} rows={3} placeholder="In their own words. Two or three sentences." style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <FieldLabel>Name</FieldLabel>
          <input value={t.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder="Full name, as they want it shown" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>Role label</FieldLabel>
          <input list="tm-roles" value={t.role} onChange={(e) => onPatch({ role: e.target.value })} placeholder="Student" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>Attribution (after the name)</FieldLabel>
          <input value={t.org} onChange={(e) => onPatch({ org: e.target.value })} placeholder="Cohort 03 · Partner school · Operator" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>Photo link</FieldLabel>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={t.photo} onChange={(e) => onPatch({ photo: e.target.value })} placeholder="https://… or /site/v-1.jpg" style={fieldStyle} />
            {t.photo && (
              <a href={t.photo} target="_blank" rel="noreferrer" title="Open photo" style={{ color: COLORS.indigo, display: "flex" }}>
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.faint, lineHeight: 1.5 }}>
        Approve only quotes you have permission to publish, attributed to real people. The photo is a link (a shared image or a
        file under the site folder), landscape, about 4:3.
      </div>
    </Card>
  );
}

export default function SiteAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const saver = useDebouncedSaver();

  useEffect(() => {
    api.get("/api/site").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error && !data) return <Notice>{error}</Notice>;
  if (!data) return <Loading />;

  const setTicker = (ticker) => {
    setData((d) => ({ ...d, ticker }));
    saver.schedule("ticker", () => api.put("/api/site", { ticker }));
  };

  const patchTestimonial = (id, fields) => {
    setData((d) => ({ ...d, testimonials: d.testimonials.map((t) => (t.id === id ? { ...t, ...fields } : t)) }));
    saver.schedule(`tm:${id}`, async () => {
      const current = { ...data.testimonials.find((t) => t.id === id), ...fields };
      await api.put(`/api/site/testimonials/${id}`, current);
    });
  };

  const addTestimonial = async () => {
    try {
      const created = await api.post("/api/site/testimonials", { quote: "New testimonial", approved: false });
      setData((d) => ({ ...d, testimonials: [...d.testimonials, created] }));
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteTestimonial = async (id) => {
    if (!window.confirm("Delete this testimonial? This cannot be undone.")) return;
    try {
      await api.del(`/api/site/testimonials/${id}`);
      setData((d) => ({ ...d, testimonials: d.testimonials.filter((t) => t.id !== id) }));
    } catch (e) {
      setError(e.message);
    }
  };

  const live = data.testimonials.filter((t) => t.approved && t.quote.trim()).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px 80px" }}>
      <PageTitle
        title="Website"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SaveIndicator status={saver.status} />
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: COLORS.indigo, textDecoration: "none", border: `1px solid ${COLORS.indigoBorder}`, background: COLORS.indigoSoft, borderRadius: 10, padding: "8px 14px" }}
            >
              <Globe size={15} /> Open the site
            </a>
          </div>
        }
      />
      {(error || saver.error) && (
        <Notice
          onClose={() => {
            setError(null);
            saver.clearError();
          }}
        >
          {error || saver.error}
        </Notice>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <TickerPanel ticker={data.ticker} defaults={data.defaultTicker} onChange={setTicker} />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <SectionLabel style={{ marginBottom: 6 }}>Testimonials</SectionLabel>
              <div style={{ fontSize: 14, color: COLORS.sub, lineHeight: 1.55 }}>
                {live === 0
                  ? "None approved yet, so the site shows clearly-labelled placeholder cards. Approve one and the placeholders disappear."
                  : `${live} approved and showing on the site, in the order they were added.`}
              </div>
            </div>
            <PrimaryButton icon={Quote} onClick={addTestimonial}>
              Add testimonial
            </PrimaryButton>
          </div>
          <datalist id="tm-roles">
            {ROLE_SUGGESTIONS.map((r) => (
              <option value={r} key={r} />
            ))}
          </datalist>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.testimonials.map((t) => (
              <TestimonialCard key={t.id} t={t} onPatch={(f) => patchTestimonial(t.id, f)} onDelete={() => deleteTestimonial(t.id)} />
            ))}
          </div>
        </div>

        <Card style={{ padding: 22, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}` }}>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
            <strong>Curriculum.</strong> The lessons on the site come from the Lesson Editor: open a lesson, click <strong>Website</strong>,
            set it to Shown and give it a stage, week and public description. Until any lesson is shown, the site displays the
            prototype&apos;s sample curriculum.
          </div>
        </Card>
      </div>
    </div>
  );
}
