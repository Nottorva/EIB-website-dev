"use client";

// The curriculum as a commit graph. Paths are measured off the live DOM and
// drawn as SVG; each branch, its node dot and its words share one value, the
// row's position in the viewport. Only the accordion open/closed set is React
// state; every per-frame value is written to the DOM directly.

import React, { useEffect, useRef, useState } from "react";

const BAND = 0.25; // share of the screen, top and bottom, over which a row fades
const TRUNK = 0.95; // screen height the trunk front runs along
const EDGE = 30; // soft edge of the word reveal, as a share of block width

const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);
const smooth = (t) => t * t * (3 - 2 * t);
const pad2 = (n) => String(n).padStart(2, "0");

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const asWord = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Curriculum({ stages, lessonCount }) {
  const graphRef = useRef(null);
  const svgRef = useRef(null);
  const headRef = useRef(null);
  const firstId = stages[0]?.lessons[0]?.id;
  const [open, setOpen] = useState(() => new Set(firstId ? [firstId] : []));

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    const graph = graphRef.current;
    const svg = svgRef.current;
    const head = headRef.current;
    if (!graph || !svg || !head) return undefined;
    const kids = Array.from(graph.querySelectorAll(".lessons > li"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let spine = null, spineLen = 1, rows = [], headY = 0;

    /** 1 through the middle of the screen, ramping to 0 at the top and bottom. */
    function bandVis(cy, vh) {
      const b = BAND, v = cy / vh;
      if (v >= 1 || v <= 0) return 0;
      if (v > 1 - b) return (1 - v) / b;
      if (v < b) return v / b;
      return 1;
    }

    function setMask(el, v) {
      el.style.webkitMaskImage = v;
      el.style.maskImage = v;
    }

    function layout() {
      const gr = graph.getBoundingClientRect();
      const W = Math.round(gr.width), H = Math.round(gr.height);
      if (W < 2 || !kids.length) return;

      const narrow = W < 760;
      const spineX = narrow ? 13 : Math.round(W / 2);
      const r = narrow ? 13 : 26; // radius of the quarter turn
      headY = Math.round(head.getBoundingClientRect().bottom - gr.top) - 26;

      const plan = [];
      let lastNode = headY;
      kids.forEach((el) => {
        const box = el.getBoundingClientRect();

        if (el.classList.contains("stagemark")) {
          const sy = Math.max(lastNode, Math.round(box.top - gr.top + box.height / 2));
          plan.push({ kind: "stage", el, nodeY: sy });
          lastNode = sy;
          return;
        }

        const ru = el.querySelector(".lrule").getBoundingClientRect();
        const ruleY = Math.round(ru.top - gr.top + ru.height / 2);
        const nodeY = Math.max(lastNode, Math.round(box.top - gr.top));
        // the side is data on the row, never derived from child order
        const left = !narrow && el.getAttribute("data-side") === "l";
        const endX = Math.round((left ? box.left : box.right) - gr.left);
        const cx = left ? spineX - r : spineX + r;
        // straight down off the trunk, quarter turn, and from there it IS the rule
        plan.push({
          kind: "lesson",
          el,
          left,
          nodeY,
          d: "M" + spineX + " " + nodeY + "V" + Math.max(nodeY + 1, ruleY - r) + "A" + r + " " + r + " 0 0 " + (left ? 1 : 0) + " " + cx + " " + ruleY + "H" + endX,
        });
        lastNode = nodeY;
      });

      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.innerHTML =
        '<path class="spine" d="M' + spineX + " " + headY + "V" + lastNode + '"/>' +
        plan
          .filter((o) => o.kind === "lesson")
          .map((o) => '<path class="limb" d="' + o.d + '"/>')
          .join("") +
        '<circle class="dot dot--head" cx="' + spineX + '" cy="' + headY + '" r="6"/>' +
        plan
          .map((o) =>
            // a stage tag interrupts the trunk with its own opaque pill, so it needs no dot
            o.kind === "stage" ? '<circle class="gdot" r="0"/>' : '<circle class="dot gdot" cx="' + spineX + '" cy="' + o.nodeY + '" r="4.5"/>'
          )
          .join("");

      spine = svg.querySelector(".spine");
      spineLen = spine.getTotalLength();
      spine.style.strokeDasharray = String(spineLen);

      const limbEls = svg.querySelectorAll(".limb");
      const dotEls = svg.querySelectorAll(".gdot");
      let k = 0;
      rows = plan.map((o, i) => {
        const row = { kind: o.kind, el: o.el, left: o.left, dot: dotEls[i] };
        if (o.kind === "lesson") {
          row.limb = limbEls[k++];
          row.len = row.limb.getTotalLength();
          row.limb.style.strokeDasharray = String(row.len);
        }
        return row;
      });

      tick();
    }

    function tick() {
      if (!spine) return;

      if (reduced) {
        spine.style.strokeDashoffset = "0";
        rows.forEach((row) => {
          row.dot.style.opacity = "1";
          if (row.kind === "lesson") {
            row.limb.style.strokeDashoffset = "0";
            setMask(row.el, "none");
          }
          row.el.style.visibility = "visible";
          row.el.style.opacity = "1";
        });
        return;
      }

      const gr = graph.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // the trunk is structure: it runs ahead of the reader and stays drawn
      spine.style.strokeDashoffset = String(spineLen - clamp(vh * TRUNK - gr.top - headY, 0, spineLen));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const box = row.el.getBoundingClientRect();
        const vis = smooth(bandVis(box.top + box.height / 2, vh));
        row.dot.style.opacity = vis.toFixed(3);

        if (row.kind === "stage") {
          row.el.style.opacity = vis.toFixed(3);
          row.el.style.visibility = vis <= 0.002 ? "hidden" : "visible";
          continue;
        }

        row.limb.style.strokeDashoffset = String(row.len * (1 - vis));

        if (vis <= 0.002) {
          row.el.style.visibility = "hidden";
          continue;
        }
        row.el.style.visibility = "visible";
        if (vis >= 0.998) {
          setMask(row.el, "none");
          continue;
        }
        // uncover the words the way this branch travels: outward from the trunk
        const front = vis * (100 + 2 * EDGE) - EDGE;
        setMask(row.el, "linear-gradient(" + (row.left ? 270 : 90) + "deg," + "rgba(0,0,0,1) " + (front - EDGE).toFixed(2) + "%," + "rgba(0,0,0,0) " + front.toFixed(2) + "%)");
      }
    }

    let pending = false;
    function queueLayout() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        layout();
      });
    }

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        tick();
        queued = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", queueLayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    // re-measures every frame while an accordion panel drops
    const ro = window.ResizeObserver ? new ResizeObserver(queueLayout) : null;
    if (ro) ro.observe(graph);

    layout();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", queueLayout);
      if (ro) ro.disconnect();
      svg.innerHTML = "";
      kids.forEach((el) => {
        el.style.visibility = "";
        el.style.opacity = "";
        setMask(el, "");
      });
    };
  }, [stages]);

  const stageCount = stages.filter((s) => s.name).length;
  const lede =
    `${cap(asWord(lessonCount))} lesson${lessonCount === 1 ? "" : "s"}` +
    (stageCount > 1 ? ` across ${asWord(stageCount)} stages` : "") +
    ". Each one branches off the same trunk and closes with something a mentor can mark up. Open any of them.";

  return (
    <section className="sec paper" id="lessons" data-chrome="light">
      <div className="wrap">
        <div className="graph" ref={graphRef}>
          <svg className="graph-svg" ref={svgRef} aria-hidden="true" />
          <div className="ghead" ref={headRef}>
            <p className="mono eyebrow">The curriculum</p>
            <h2 className="d h2">Twelve weeks on one spine.</h2>
            <p className="lede">{lede}</p>
          </div>
          <ol className="lessons">
            {stages.map((stage, si) => (
              <React.Fragment key={`${stage.name}-${si}`}>
                {stage.label && (
                  <li className="stagemark">
                    <p className="mono">{stage.label}</p>
                  </li>
                )}
                {stage.lessons.map((l) => {
                  const isOpen = open.has(l.id);
                  const panelId = `lp-${l.id}`;
                  return (
                    <li className="lesson" data-side={l.side} data-open={isOpen ? "true" : "false"} key={l.id}>
                      <button className="lhead" type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(l.id)}>
                        <span className="mono lno">
                          Lesson {pad2(l.index)}
                          {l.week ? ` · Week ${l.week}` : ""}
                        </span>
                        <span className="ltitle">{l.title}</span>
                        <svg className="lchev" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2.5 4.5 6 8 9.5 4.5" />
                        </svg>
                      </button>
                      <div className="lrule" />
                      <div className="lpanel" id={panelId}>
                        <div>
                          <p className="lbody">{l.blurb}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </React.Fragment>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
