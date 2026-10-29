"use client";

// Website page (super admin): the public site's ticker strip. Lessons are
// published to the site from the Lesson Editor; the copy lives in
// src/lib/siteContent.js.

import React, { useEffect, useState } from "react";
import { Globe, Plus, Trash2, RotateCcw } from "lucide-react";
import { COLORS, PageTitle, Card, fieldStyle, Notice, SaveIndicator, Loading, PrimaryButton, IconButton, SectionLabel } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";

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
            <input value={t} onChange={(e) => set(i, e.target.value)} placeholder="Student Showcase on April 23" aria-label={`Ticker item ${i + 1}`} style={{ ...fieldStyle, padding: "10px 14px" }} />
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
          style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}
        >
          <RotateCcw size={14} /> Reset to defaults
        </button>
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

        <Card style={{ padding: 22, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}` }}>
          <div style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>
            <strong>Curriculum.</strong> The lessons on the site come from the Lesson Editor: open a lesson, click <strong>Website</strong>,
            set it to Shown and give it a stage, week and public description. Until any lesson is shown, the site displays the
            curriculum from <code>siteContent.js</code>.
          </div>
        </Card>
      </div>
    </div>
  );
}
