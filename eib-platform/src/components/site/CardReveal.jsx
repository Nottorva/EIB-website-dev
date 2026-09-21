"use client";
// The white card's backdrop: the design-notebook photo sits under a white
// veil. The card arrives plain white over the reel; once it has landed (its
// top reaches the top of the viewport) the veil thins to a white tint as the
// visitor keeps scrolling, so the sketch becomes the section's background. Driven from scroll with rAF and
// a CSS variable, no React state per frame.
import { useEffect, useRef } from "react";

const HOLD = 0.08; // fraction of a viewport the card stays plain white after landing
const FADE_SPAN = 0.35; // fraction of a viewport of scrolling the fade takes
const VEIL_MIN = 0.5; // the white tint that stays over the photo

export default function CardReveal({ photo }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const card = el && el.parentElement;
    if (!card) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      card.style.setProperty("--veil", "0.6");
      return () => card.style.removeProperty("--veil");
    }

    let queued = false;
    const update = () => {
      const top = card.getBoundingClientRect().top;
      const H = window.innerHeight;
      const p = Math.min(1, Math.max(0, (-top - H * HOLD) / (H * FADE_SPAN)));
      card.style.setProperty("--veil", String(1 - p * (1 - VEIL_MIN)));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        update();
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      card.style.removeProperty("--veil");
    };
  }, []);

  return (
    <div className="cardbg" ref={ref} aria-hidden="true">
      <div className="cardbg-img" style={{ backgroundImage: `url(${photo})` }} />
      <div className="cardbg-veil" />
    </div>
  );
}
