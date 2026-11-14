"use client";

// In-page viewer for a PDF slide deck. Renders each page to a canvas with
// pdf.js (loaded from cdnjs on first use), one slide under the next, sized
// to the column. Pages render only when they come near the viewport, so a
// 30-slide deck does not rasterise all at once on a phone. If the script
// fails to load, the download link still works.

import { usePdfDocument, useElementWidth, usePdfPage } from "@/lib/pdfjs";

export default function SlideDeck({ src, title }) {
  const { doc, error } = usePdfDocument(src);
  const [colRef, width] = useElementWidth();
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
  // render when the slide is within two screens of the viewport
  const { canvasRef, boxRef, ratio } = usePdfPage(doc, index, width, { rootMargin: "200% 0px", ratio: 9 / 16 });
  return (
    <figure className="slide" ref={boxRef} style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} aria-label={`Slide ${index} of ${count}`} />
      <figcaption className="mono slideno">
        {String(index).padStart(2, "0")} / {String(count).padStart(2, "0")}
      </figcaption>
    </figure>
  );
}
