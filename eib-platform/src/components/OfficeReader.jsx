"use client";

// Draws a PowerPoint (.pptx) or Word (.docx) file inside the page, so a
// lesson's slides or teaching plan can be read without downloading. The file
// is fetched with the viewer's own sign-in and drawn in their browser
// (pptx-preview / docx-preview, loaded only when a preview is opened); it is
// never sent to an outside service. Each is drawn at its natural size and
// then scaled to the width of the popup.

import { useEffect, useRef, useState } from "react";
import { COLORS } from "./ui";
import { useElementWidth } from "@/lib/pdfjs";

const SLIDE_WIDTH = 960;

// "pptx" | "docx" | null (null = a format no browser can draw: download only)
export function officeKind(file) {
  const name = (file?.name || "").toLowerCase();
  const type = file?.type || "";
  if (name.endsWith(".pptx") || type.includes("presentationml.presentation")) return "pptx";
  if (name.endsWith(".docx") || type.includes("wordprocessingml.document")) return "docx";
  return null;
}

// width / height of the slides, read from the deck itself (16:9 if unreadable)
async function slideRatio(buffer) {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("ppt/presentation.xml").async("string");
    const m = xml.match(/<p:sldSz[^>]*?cx="(\d+)"[^>]*?cy="(\d+)"/);
    if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  } catch {}
  return 16 / 9;
}

export default function OfficeReader({ src, kind, onError, loadingText = "Loading…" }) {
  const [colRef, width] = useElementWidth();
  const hostRef = useRef(null);
  const [natural, setNatural] = useState(0); // the drawing's own width, in px
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let previewer = null;
    const host = hostRef.current;
    (async () => {
      const res = await fetch(src, { credentials: "include" });
      if (!res.ok) throw new Error(`The file could not be loaded (${res.status}).`);
      const buffer = await res.arrayBuffer();
      if (cancelled) return;
      if (kind === "pptx") {
        const [{ init }, ratio] = await Promise.all([import("pptx-preview"), slideRatio(buffer)]);
        if (cancelled) return;
        previewer = init(host, { width: SLIDE_WIDTH, height: Math.round(SLIDE_WIDTH / ratio), mode: "list" });
        await previewer.preview(buffer);
        if (cancelled) return;
        if (!previewer.slideCount) throw new Error("No slides found.");
        setNatural(SLIDE_WIDTH);
      } else {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(buffer, host, null, { className: "eib-docx", inWrapper: true, ignoreLastRenderedPageBreak: false });
        if (cancelled) return;
        const pages = [...host.querySelectorAll("section.eib-docx")];
        if (pages.length === 0) throw new Error("Nothing to show.");
        setNatural(Math.max(...pages.map((p) => p.offsetWidth)));
      }
      setReady(true);
    })().catch(() => { if (!cancelled) onError?.(); });
    return () => {
      cancelled = true;
      try { previewer?.destroy(); } catch {}
      if (host) host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, kind]);

  const zoom = natural && width ? width / natural : 1;

  return (
    <div ref={colRef} className={`eib-office eib-office-${kind}`}>
      <style>{CSS}</style>
      {!ready && <div style={{ fontSize: 13.5, color: COLORS.faint }}>{loadingText}</div>}
      <div ref={hostRef} style={{ width: natural || SLIDE_WIDTH, zoom, visibility: ready ? "visible" : "hidden", height: ready ? "auto" : 0, overflow: ready ? "visible" : "hidden" }} />
    </div>
  );
}

// The two libraries bring their own dark backdrop and fixed-height scroll
// box; here the popup does the scrolling and each slide / page is a card.
const CSS = `
.eib-office { overflow: hidden; }
.eib-office-pptx .pptx-preview-wrapper { background: transparent !important; height: auto !important; width: auto !important; overflow: visible !important; padding: 0 !important; margin: 0 !important; }
.eib-office-pptx .pptx-preview-slide-wrapper { margin: 0 0 16px 0 !important; border: 1px solid ${COLORS.border}; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 24px -18px rgba(15,23,42,0.3); box-sizing: border-box; }
.eib-office-docx .eib-docx-wrapper { background: transparent !important; padding: 0 !important; display: block !important; }
.eib-office-docx .eib-docx-wrapper > section.eib-docx { margin: 0 0 16px 0 !important; border: 1px solid ${COLORS.border}; border-radius: 10px; box-shadow: 0 8px 24px -18px rgba(15,23,42,0.3) !important; box-sizing: border-box; }
`;
