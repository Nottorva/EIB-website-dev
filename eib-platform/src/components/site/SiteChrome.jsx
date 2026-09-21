"use client";

// Fixed chrome for the public site: the ticker strip and the glass nav.
// The bar reads whichever [data-chrome] section sits under y=74 and inverts
// itself over the light ones. Scroll work happens in a rAF, never in state.

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function SiteChrome({ ticker, user, identity, authMode }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const zones = Array.from(document.querySelectorAll(".site [data-chrome]"));
    const theme = () => {
      const y = 74;
      let t = "dark";
      // iterate in reverse so a section overlaying another wins
      for (let i = zones.length - 1; i >= 0; i--) {
        const r = zones[i].getBoundingClientRect();
        if (r.top <= y && r.bottom > y) {
          t = zones[i].getAttribute("data-chrome");
          break;
        }
      }
      el.classList.toggle("on-light", t === "light");
    };
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        theme();
        queued = false;
      });
    };
    theme();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const name = user?.name || identity?.name || null;

  return (
    <header className="chrome" ref={ref}>
      <div className="ticker">
        <div className="tickwin">
          {/* the track holds the items twice so the loop is seamless */}
          <div className="ticktrack">
            {[0, 1].map((pass) =>
              ticker.map((item, i) => (
                <React.Fragment key={`${pass}-${i}`}>
                  <span className="tk">{item}</span>
                  <span className="tksep" aria-hidden="true">
                    {"◆"}
                  </span>
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>
      <nav className="nav glass" aria-label="Primary">
        {/* the travelling highlight: a translated strip inside a clipped box,
            so the animation runs on the compositor instead of repainting the
            bar (and re-blurring what is behind it) every frame */}
        <i className="sheen" aria-hidden="true" />
        <a className="brand" href="#reel">
          <span className="mark">EIB</span>
        </a>
        {user ? (
          <Link className="apply" href="/platform">
            Open the platform
          </Link>
        ) : (
          <Link className="apply" href="/apply">
            Apply<span className="apply-x"> now</span>
          </Link>
        )}
        {name ? (
          <Link className="signin" href={user ? "/platform" : "/apply"} title={name}>
            {name}
          </Link>
        ) : authMode === "google" ? (
          <button className="signin" type="button" onClick={() => signIn("google", { callbackUrl: "/platform" })}>
            Sign in
          </button>
        ) : (
          <Link className="signin" href="/platform">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
