"use client";
// A slow rotation of short quotes under the card copy. All quotes are in the
// DOM stacked in one grid cell (so the block never changes height) and the
// current one is faded in. Auto-advances unless the pointer is over it, the
// tab is hidden, or the visitor prefers reduced motion; the dots jump.
import { useEffect, useRef, useState } from "react";

export default function QuoteCarousel({ quotes, interval = 6500 }) {
  const [current, setCurrent] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (quotes.length < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = setInterval(() => {
      if (paused.current || document.visibilityState !== "visible") return;
      setCurrent((n) => (n + 1) % quotes.length);
    }, interval);
    return () => clearInterval(timer);
  }, [quotes.length, interval]);

  const hold = (on) => () => {
    paused.current = on;
  };

  return (
    <div className="qcar" onMouseEnter={hold(true)} onMouseLeave={hold(false)} onFocus={hold(true)} onBlur={hold(false)}>
      <div className="qstack">
        {quotes.map((q, n) => (
          <blockquote key={q} className={"qq" + (n === current ? " is-on" : "")} aria-hidden={n !== current}>
            <p>{q}</p>
          </blockquote>
        ))}
      </div>
      {quotes.length > 1 && (
        <div className="qdots" role="tablist" aria-label="Quotes">
          {quotes.map((q, n) => (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={n === current}
              aria-label={`Quote ${n + 1} of ${quotes.length}`}
              className={n === current ? "is-on" : ""}
              onClick={() => setCurrent(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
