"use client";
// A slow rotation of short quotes under the card copy. All quotes are in the
// DOM stacked in one grid cell (so the block never changes height) and the
// current one is faded in. Auto-advances on a timer (skipping ticks while
// the tab is hidden), pauses while hovered or focused, stops entirely for
// readers who prefer reduced motion, and has a pause button so the rotation
// can always be stopped (WCAG 2.2.2). The dots jump to a quote.
import { useEffect, useState } from "react";

export default function QuoteCarousel({ quotes, interval = 5000 }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const running = quotes.length > 1 && !paused && !hovering && !reduced;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setCurrent((n) => (n + 1) % quotes.length);
    }, interval);
    return () => clearInterval(timer);
  }, [running, quotes.length, interval]);

  return (
    <div className="qcar" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
      <div className="qstack">
        {quotes.map((q, n) => (
          <blockquote key={q} className={"qq" + (n === current ? " is-on" : "")} aria-hidden={n !== current}>
            <p>{q}</p>
          </blockquote>
        ))}
      </div>
      {quotes.length > 1 && (
        <div className="qctl">
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
          <button type="button" className="qpause mono" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused || reduced ? "Play" : "Pause"}
          </button>
        </div>
      )}
    </div>
  );
}
