"use client";

// The pinned hero reel plus the card overlay. Ported from the prototype:
// everything is a pure function of scroll offset, written straight to the
// DOM inside requestAnimationFrame. No React state is touched per frame.

import React, { useEffect, useRef, useState } from "react";
import { LEXICON } from "@/lib/siteContent";

// Tuning. These were the prototype's Tune-panel values; the panel is gone.
const P = {
  lean: 50, // offset between the top and bottom of the diagonal, % of viewport width
  phase: 0.75, // scroll spent on each panel, in viewport heights
  sweep: 1.0, // share of each phase spent moving; the rest holds the text still
  feather: 0, // width of the reveal band measured perpendicular to the diagonal, px
  curve: 1.0, // 0 = linear ramp across that band, 1 = smoothstep
  holdSpan: 0.85, // scroll spent building words before the card arrives, in viewport heights
  fringeMax: 1.16, // depth of the word field, in viewport heights
  words: 75,
  orient: "vertical",
};

const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);
const smooth = (t) => t * t * (3 - 2 * t);

function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildField() {
  const rnd = mulberry(20260917);
  const field = [];
  const COLS = 11;
  for (let f = 0; f < 200; f++) {
    field.push({
      t: LEXICON[(rnd() * LEXICON.length) | 0],
      // walk the columns in turn so words sit apart instead of piling on each other
      x: ((f % COLS) + 0.12 + rnd() * 0.76) / COLS,
      u: Math.pow(rnd(), 0.78), // depth into the band; 1 sits against the solid edge
      s: 0.72 + rnd() * 0.5, // size jitter
      r: rnd(), // when this word switches on as density rises
      d: rnd(), // extra upward drift
      v: rnd() < 0.5, // orientation when the field is mixed
    });
  }
  return field;
}

const shotStyle = (panel) => ({
  backgroundColor: panel.tint,
  backgroundImage: `url("${panel.photo}")`,
  "--pos": panel.position || "50% 50%",
  "--pos-m": panel.mobilePosition || panel.position || "50% 50%",
  "--size": panel.size || "cover",
  "--shade": panel.shade ?? 0,
});

export default function Reel({ reel }) {
  const reelRef = useRef(null);
  const stageRef = useRef(null);
  const motesRef = useRef(null);
  const skipFn = useRef(null);
  const [reduced, setReduced] = useState(false);
  const panels = [reel.hero, ...reel.stages];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setReduced(true);
  }, []);

  useEffect(() => {
    const reelEl = reelRef.current;
    const stage = stageRef.current;
    const motes = motesRef.current;
    const after = document.getElementById("after");
    const site = reelEl?.closest(".site");
    if (!reelEl || !stage || !after) return undefined;

    if (reduced) {
      site?.classList.add("reduced");
      return () => site?.classList.remove("reduced");
    }

    const shots = Array.from(stage.querySelectorAll(".layer[data-i] .shot"));
    const edges = Array.from(stage.querySelectorAll(".layer[data-i] .edge"));
    const wIn = Array.from(stage.querySelectorAll(".capIn"));
    const wOut = Array.from(stage.querySelectorAll(".capOut"));
    const bars = Array.from(stage.querySelectorAll(".rail u"));
    const N = shots.length;
    const field = buildField();
    const archivo = getComputedStyle(stage).getPropertyValue("--font-archivo").trim();
    const FONT = (archivo ? archivo + "," : "") + '"Archivo","Helvetica Neue",Arial,sans-serif';

    let W = 1, H = 1, diagLen = 1, holdLen = 1, slideLen = 1, nx = 1, ny = 0, ang = 90, GL = 1;

    /* ---------------------------------------------- diagonal geometry ---- */
    function geometry() {
      const leanPx = (P.lean / 100) * W;
      const L = Math.sqrt(H * H + leanPx * leanPx) || 1;
      nx = H / L; // unit normal to the diagonal, toward the revealed side
      ny = leanPx / L;
      ang = (Math.atan2(nx, -ny) * 180) / Math.PI; // the same direction, as a CSS gradient angle
      GL = Math.max(1, Math.abs(W * nx) + Math.abs(H * ny));
    }

    function travel() {
      const leanPx = (P.lean / 100) * W;
      const need = GL * 0.5 + P.feather / 2;
      const startPx = Math.max(W + Math.max(0, leanPx) + 8, W / 2 + (need + (H / 2) * ny) / nx);
      const endPx = Math.min(0 - Math.max(0, -leanPx) - 8, W / 2 - (need - (H / 2) * ny) / nx);
      return [(startPx / W) * 100, (endPx / W) * 100];
    }

    function gradientStop(xTopPct) {
      const s = (W / 2 - (xTopPct / 100) * W) * nx + (H / 2) * ny;
      return 0.5 - s / GL;
    }

    function band(mid, invert) {
      const half = P.feather / 2 / GL;
      const out = [invert ? "rgba(0,0,0,1) 0%" : "rgba(0,0,0,0) 0%"];
      for (let i = 0; i <= 5; i++) {
        const u = i / 5;
        let a = u + (smooth(u) - u) * P.curve;
        if (invert) a = 1 - a;
        out.push("rgba(0,0,0," + a.toFixed(3) + ") " + clamp((mid - half + 2 * half * u) * 100, -60, 160).toFixed(2) + "%");
      }
      out.push(invert ? "rgba(0,0,0,0) 100%" : "rgba(0,0,0,1) 100%");
      return "linear-gradient(" + ang.toFixed(2) + "deg," + out.join(",") + ")";
    }

    function setMask(el, v) {
      el.style.webkitMaskImage = v;
      el.style.maskImage = v;
    }

    /* --------------------------------------------------- the diagonals --- */
    function runReel(p) {
      const seg = 1 / N;
      const [from, to] = travel();
      const stop = [];

      for (let i = 1; i <= N; i++) {
        const local = clamp((p - (i - 1) * seg) / seg, 0, 1);
        const e = clamp(local / P.sweep, 0, 1);
        const xt = from + (to - from) * e;
        const xb = xt - P.lean;

        const s = shots[i - 1].style;
        s.setProperty("--xt", xt.toFixed(3) + "%");
        s.setProperty("--xb", xb.toFixed(3) + "%");

        const tp = (xt / 100) * W, bp = (xb / 100) * W;
        const es = edges[i - 1].style;
        es.setProperty("--mid", ((tp + bp) / 2).toFixed(2) + "px");
        es.setProperty("--ang", ((-Math.atan2(tp - bp, H) * 180) / Math.PI).toFixed(3) + "deg");
        es.opacity = e > 0.002 && e < 0.998 ? "1" : "0";

        if (bars[i - 1]) bars[i - 1].style.transform = "scaleX(" + local.toFixed(4) + ")";
        stop[i] = gradientStop(xt);
      }

      const half = P.feather / 2 / GL;
      for (let c = 0; c <= N; c++) {
        // revealed by its own diagonal, un-revealed by the next one along the very same line
        const tIn = c === 0 ? -9 : stop[c];
        const tOut = c < N ? stop[c + 1] : 9;
        const live = !(tIn >= 1 + half) && !(tOut <= -half);
        wOut[c].style.visibility = live ? "visible" : "hidden";
        if (!live) continue;
        setMask(wIn[c], c === 0 || tIn <= -half ? "none" : band(tIn, false));
        setMask(wOut[c], c === N || tOut >= 1 + half ? "none" : band(tOut, true));
      }
    }

    /* ----------------------------------------- the card and its words ---- */
    /* The card needs no transform. Its flow position is pulled up by exactly one
       viewport, so through the build-up it creeps from just under the fold to the
       bottom border, then rises to cover at 1:1 with the scroll, with no change of
       speed when the stage unpins and the page carries on normally. */
    function runCard(over) {
      const cardTop = H + holdLen - over; // viewport y of the card's top edge
      const dens = clamp(over / holdLen, 0, 1);

      if (over <= 0 || cardTop <= 0) {
        motes.style.display = "none";
        return;
      }
      motes.style.display = "block";

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (motes.width !== Math.round(W * dpr)) motes.width = Math.round(W * dpr);
      if (motes.height !== Math.round(H * dpr)) motes.height = Math.round(H * dpr);

      const g = motes.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      const sizeScale = clamp(W / 1440, 0.5, 1.15);
      const fringe = H * P.fringeMax * (0.3 + 0.7 * dens);
      // through the build-up the words pile against the bottom border; after that
      // the solid edge of the card itself carries them up
      const edgeY = Math.min(H, cardTop);
      const n = Math.min(P.words, field.length);

      g.fillStyle = "#fff";
      g.textBaseline = "middle";

      for (let i = 0; i < n; i++) {
        const w = field[i];
        const y = edgeY - (1 - w.u) * fringe - w.d * dens * H * 0.22;
        if (y < -140 || y > H + 140) continue;
        // deeper words switch on first, and every word has its own threshold,
        // so the field thickens rather than simply brightening
        const a = clamp(w.u * 1.9 - 0.15, 0, 1) * clamp((dens - w.r * 0.9) / 0.25, 0, 1) * 0.78;
        if (a <= 0.012) continue;

        g.globalAlpha = a;
        g.font = "600 " + ((11 + 33 * Math.pow(w.u, 0.75)) * w.s * sizeScale).toFixed(1) + "px " + FONT;
        const x = w.x * W;
        if (P.orient === "vertical" || (P.orient === "mixed" && w.v)) {
          g.save();
          g.translate(x, y);
          g.rotate(-Math.PI / 2);
          g.fillText(w.t, 0, 0);
          g.restore();
        } else {
          g.fillText(w.t, x, y);
        }
      }
      g.globalAlpha = 1;

      // the words fuse into the mass, which is what actually closes the bottom row
      const gh = Math.max(2, fringe * 0.2);
      if (edgeY > -gh) {
        const grad = g.createLinearGradient(0, edgeY - gh, 0, edgeY);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255," + dens.toFixed(3) + ")");
        g.fillStyle = grad;
        g.fillRect(0, edgeY - gh, W, H - (edgeY - gh));
      }
    }

    /* ----------------------------------------------------------- loop ---- */
    function update() {
      const span = diagLen + holdLen + slideLen;
      const scrolled = clamp(-reelEl.getBoundingClientRect().top, 0, span);
      runReel(clamp(scrolled / diagLen, 0, 1));
      runCard(clamp(scrolled - diagLen, 0, holdLen + slideLen));
    }

    function measure() {
      W = stage.clientWidth;
      H = stage.clientHeight;
      const narrow = W < 860;
      diagLen = H * N * P.phase * (narrow ? 0.85 : 1);
      holdLen = H * P.holdSpan;
      slideLen = H; // exactly one viewport, so the card lands flush and hands back to normal scroll
      reelEl.style.height = Math.round(H + diagLen + holdLen + slideLen) + "px";
      after.style.marginTop = -Math.round(slideLen) + "px";
      geometry();
      update();
    }

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        update();
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    skipFn.current = () => {
      const top = reelEl.getBoundingClientRect().top + window.scrollY + diagLen + holdLen + slideLen;
      window.scrollTo({ top, behavior: "smooth" });
    };

    measure();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      skipFn.current = null;
      reelEl.style.height = "";
      after.style.marginTop = "";
      if (motes) motes.style.display = "none";
    };
  }, [reduced]);

  if (reduced) {
    // Static stack: each photo followed by its caption, no pinning, no masks.
    return (
      <div className="reel" id="reel" data-chrome="dark" ref={reelRef}>
        <div className="stage" ref={stageRef}>
          {panels.map((panel, i) => (
            <div className="layer" key={i}>
              <div className="shot" aria-hidden="true" style={shotStyle(panel)} />
              <Caption panel={panel} hero={i === 0} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="reel" id="reel" data-chrome="dark" ref={reelRef}>
        <div className="stage" ref={stageRef}>
          <div className="layer layer--base">
            <div className="shot" aria-hidden="true" style={shotStyle(reel.hero)} />
          </div>
          {reel.stages.map((panel, i) => (
            <div className="layer" data-i={i + 1} key={i}>
              <div className="shot" aria-hidden="true" style={shotStyle(panel)} />
              <div className="edge" aria-hidden="true" />
            </div>
          ))}

          <div className="scrim" aria-hidden="true" />
          <div className="caps">
            <div className="capOut">
              <div className="capIn capIn--open">
                <Caption panel={reel.hero} hero />
              </div>
            </div>
            {reel.stages.map((panel, i) => (
              <div className="capOut" key={i}>
                <div className="capIn">
                  <Caption panel={panel} />
                </div>
              </div>
            ))}
          </div>

          <div className="hud">
            <div className="rail" aria-hidden="true">
              <span className="mono">Principle</span>
              {reel.stages.map((_, i) => (
                <i key={i}>
                  <u />
                </i>
              ))}
            </div>
            <button className="skip" type="button" onClick={() => skipFn.current && skipFn.current()}>
              Skip to the detail
            </button>
          </div>
        </div>
      </div>
      <canvas className="motes" ref={motesRef} aria-hidden="true" />
    </>
  );
}

function Caption({ panel, hero = false }) {
  return (
    <div className={hero ? "cap cap--hero" : "cap"}>
      <p className="mono kick">{panel.kicker}</p>
      {hero ? <h1 className="d">{panel.headline}</h1> : <h2 className="d">{panel.headline}</h2>}
      {panel.body && <p className={hero ? "hero-sub" : undefined}>{panel.body}</p>}
      {panel.meta && <p className="mono meta">{panel.meta}</p>}
    </div>
  );
}
