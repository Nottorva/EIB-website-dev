"use client";

// In-page viewer for a PDF slide deck. Renders each page to a canvas with
// pdf.js (loaded from cdnjs on first use), one slide under the next, sized
// to the column. Pages render only when they come near the viewport, so a
// 30-slide deck does not rasterise all at once on a phone. If the script
// fails to load, the download link still works.

import React, { useEffect, useRef, useState } from "react";

import { loadPdfJs } from "@/lib/pdfjs";

export default function SlideDeck({ src, title }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);
  const colRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadPdfJs()
      .then((lib) => lib.getDocument(src).promise)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load the slides."); });
    return () => { cancelled = true; };
  }, [src]);

  // the column width drives the render scale; re-measure on resize
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

  return (
    <div className="deckcol" ref={colRef}>
      {error && (
        <p className="deckmsg">
          The viewer could not start. <a href={src} download>Download the PDF</a> instead.
        </p>
      )}
      {!error && !doc && <p className="deckmsg">Loading {title ? title.toLowerCase() : "the slides"}…</p>}
      {doc && width > 0 && Array.from({ length: count }, (_, i) => (
        <Slide key={i} doc={doc} index={i + 1} count={count} width={width} />
      ))}
    </div>
  );
}

function Slide({ doc, index, count, width }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(9 / 16);

  // render when the slide is within two screens of the viewport
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setNear(true); },
      { rootMargin: "200% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return undefined;
    let cancelled = false;
    let task = null;
    doc.getPage(index).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (width / base.width) * dpr;
      const vp = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      task = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      if (task) task.cancel();
    };
  }, [near, doc, index, width]);

  return (
    <figure className="slide" ref={boxRef} style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} aria-label={`Slide ${index} of ${count}`} />
      <figcaption className="mono slideno">
        {String(index).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </figcaption>
    </figure>
  );
}
