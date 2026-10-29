"use client";

// Renders a PDF page by page inside the platform (pdf.js from cdnjs), and
// tells the parent when the reader has scrolled the last page into view.
// Used by the onboarding page so "I have read it" can only be ticked once
// the whole agreement has been seen.

import React, { useEffect, useRef, useState } from "react";
import { COLORS } from "./ui";

import { loadPdfJs } from "@/lib/pdfjs";

export default function PdfReader({ src, onReachEnd, onError }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);
  const colRef = useRef(null);
  const reached = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadPdfJs()
      .then((lib) => lib.getDocument({ url: src, withCredentials: true }).promise)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch((e) => { if (!cancelled) { setError(e.message || "Could not load the PDF."); onError?.(); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const el = colRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = doc?.numPages || 0;
  const reachEnd = () => {
    if (reached.current) return;
    reached.current = true;
    onReachEnd?.();
  };

  return (
    <div ref={colRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div style={{ fontSize: 13.5, color: COLORS.red }}>{error}</div>}
      {!error && !doc && <div style={{ fontSize: 13.5, color: COLORS.faint }}>Loading the agreement…</div>}
      {doc && width > 0 && Array.from({ length: count }, (_, i) => (
        <Page key={i} doc={doc} index={i + 1} count={count} width={width} last={i + 1 === count} onSeen={reachEnd} />
      ))}
    </div>
  );
}

function Page({ doc, index, count, width, last, onSeen }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(11 / 8.5);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the last page counts as read once most of it has been on screen
  useEffect(() => {
    if (!last) return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.intersectionRatio >= 0.6)) onSeen(); }, { threshold: [0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  useEffect(() => {
    if (!near) return undefined;
    let cancelled = false;
    let task = null;
    doc.getPage(index).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; if (task) task.cancel(); };
  }, [near, doc, index, width]);

  return (
    <figure ref={boxRef} style={{ margin: 0, position: "relative", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", aspectRatio: `1 / ${ratio}`, boxShadow: "0 8px 24px -18px rgba(15,23,42,0.3)" }}>
      <canvas ref={canvasRef} aria-label={`Page ${index} of ${count}`} style={{ display: "block", width: "100%", height: "100%" }} />
      <figcaption style={{ position: "absolute", right: 10, bottom: 8, fontSize: 11.5, fontWeight: 800, color: COLORS.sub, background: "rgba(255,255,255,0.9)", border: `1px solid ${COLORS.border}`, padding: "3px 8px", borderRadius: 999 }}>
        {index} / {count}
      </figcaption>
    </figure>
  );
}
