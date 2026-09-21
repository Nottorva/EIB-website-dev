"use client";
// The white card's backdrop: the design-notebook photo sits under a white
// veil. The card arrives plain white over the reel, then during the last
// stretch of its slide the veil thins to a white tint, so by the time the
// copy is in reading position the sketch is already there behind it. Driven
// from scroll with rAF, written as opacity on the veil (its own compositor
// layer), no React state per frame.
import { useEffect, useRef } from "react";

const FADE_FROM = 0.62; // card top at this fraction of the viewport: still plain white
const FADE_TO = 0.12; // card top here: fully at the tint (just before it lands)
const VEIL_MIN = 0.5; // the white tint that stays over the photo

export default function CardReveal({ photo }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const card = el && el.parentElement;
    const veil = el && el.querySelector(".cardbg-veil");
    if (!card || !veil) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      veil.style.opacity = String(VEIL_MIN);
      return () => {
        veil.style.opacity = "";
      };
    }

    let queued = false;
    const update = () => {
      const top = card.getBoundingClientRect().top;
      const H = window.innerHeight;
      const p = Math.min(1, Math.max(0, (FADE_FROM * H - top) / ((FADE_FROM - FADE_TO) * H)));
      const next = (1 - p * (1 - VEIL_MIN)).toFixed(3);
      if (veil.style.opacity !== next) veil.style.opacity = next;
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
      veil.style.opacity = "";
    };
  }, []);

  return (
    <div className="cardbg" ref={ref} aria-hidden="true">
      <div className="cardbg-img" style={{ backgroundImage: `url(${photo})` }} />
      <div className="cardbg-veil" />
    </div>
  );
}
