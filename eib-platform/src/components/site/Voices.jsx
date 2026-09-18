"use client";

// Photos and testimonials: a native scroll-snap carousel with an edge-fade
// mask and arrow buttons that disable at each end. Button state is written
// straight to the DOM on scroll, not through React state.

import React, { useEffect, useRef } from "react";

const cssUrl = (u) => (u ? `url("${String(u).replace(/"/g, "%22")}")` : undefined);

export default function Voices({ testimonials, placeholder }) {
  const winRef = useRef(null);
  const trackRef = useRef(null);
  const prevRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => {
    const win = winRef.current;
    const track = trackRef.current;
    if (!win || !track) return undefined;
    const soft = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function step() {
      const s = track.querySelector(".slide");
      if (!s) return 320;
      const cs = getComputedStyle(track);
      return s.getBoundingClientRect().width + (parseFloat(cs.columnGap || cs.gap) || 18);
    }
    const go = (dir) => win.scrollBy({ left: dir * step(), behavior: soft ? "smooth" : "auto" });
    const onPrev = () => go(-1);
    const onNext = () => go(1);
    function sync() {
      const max = win.scrollWidth - win.clientWidth - 2;
      if (prevRef.current) prevRef.current.disabled = win.scrollLeft <= 2;
      if (nextRef.current) nextRef.current.disabled = win.scrollLeft >= max;
    }
    prevRef.current?.addEventListener("click", onPrev);
    nextRef.current?.addEventListener("click", onNext);
    win.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
    return () => {
      prevRef.current?.removeEventListener("click", onPrev);
      nextRef.current?.removeEventListener("click", onNext);
      win.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <section className="sec paper" id="voices" data-chrome="light">
      <div className="wrap">
        <p className="mono eyebrow">From the room</p>
        <h2 className="d h2">What it looks like from the inside.</h2>
        <p className="lede">
          Students, faculty, mentors and the Demo Day panel, in their own words.
          {placeholder && <span className="ph"> Photographs and quotes below are placeholders.</span>}
        </p>
      </div>
      <div className="carousel">
        <div className="carwin" ref={winRef} tabIndex={0} aria-label="Photos and testimonials, scrollable">
          <div className="cartrack" ref={trackRef}>
            {testimonials.map((t) => (
              <article className="slide" key={t.id}>
                <div
                  className="vshot"
                  style={{ backgroundImage: cssUrl(t.photo) }}
                  role="img"
                  aria-label={placeholder ? "Placeholder photograph" : t.name ? `Photograph of ${t.name}` : "Photograph"}
                />
                <p className="mono vrole">{t.role}</p>
                <blockquote className="vquote">
                  <p>{t.quote}</p>
                </blockquote>
                <p className="mono vattrib">{[t.name, t.org].filter(Boolean).join(" · ")}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="wrap carnav">
          <button className="carbtn" type="button" aria-label="Previous" ref={prevRef}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button className="carbtn" type="button" aria-label="Next" ref={nextRef}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
