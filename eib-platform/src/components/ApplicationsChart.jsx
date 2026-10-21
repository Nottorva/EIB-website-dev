"use client";

// Applications over time, for the Student Manager's Analytics tab.
//
// Day buckets run from the day applications opened (or the first activity,
// whichever is earlier) to today while the window is open, so the axis grows
// a day at a time on its own. Two charts, one series each, one hue:
//   - new applications per day (columns)
//   - running total (line), with the class-size cap as a reference line
// Hover gives a crosshair + tooltip; a table view sits behind a toggle.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "./ui";

const TZ = "America/Toronto";
const DAY = 86400000;
const INK = { text: COLORS.text, sub: COLORS.sub, faint: COLORS.faint, grid: "#e9ecf3", axis: "#d6dbe6" };
const SERIES = COLORS.indigo; // validated on the light surface (3:1+, L in band)

// Calendar day in Toronto, as YYYY-MM-DD.
export const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
// Noon UTC of a day key: stepping by 24h never crosses a Toronto date twice.
const noon = (key) => new Date(`${key}T12:00:00Z`);
const shortDate = (key) => noon(key).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = (key) => noon(key).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// The day series: [{ key, label, count, total }], newest last.
export function buildDays({ applications, drafts, opensAt, closesAt, now = new Date() }) {
  const stamps = [...applications.map((a) => a.submittedAt), ...drafts.map((d) => d.startedAt)].filter(Boolean);
  const today = dayKey(now);
  const candidates = [opensAt ? dayKey(opensAt) : null, ...stamps.map(dayKey)].filter(Boolean).sort();
  let start = candidates[0] || today;
  // the window closing stops the axis growing, unless activity came later
  let end = today;
  if (closesAt && dayKey(closesAt) < today) end = dayKey(closesAt);
  const latest = stamps.map(dayKey).sort().slice(-1)[0];
  if (latest && latest > end) end = latest;
  if (end < start) end = start;
  // guard: never more than 400 columns
  if ((noon(end) - noon(start)) / DAY > 400) start = dayKey(new Date(noon(end).getTime() - 400 * DAY));

  const counts = new Map();
  for (const a of applications) {
    if (!a.submittedAt) continue;
    const k = dayKey(a.submittedAt);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const days = [];
  let total = 0;
  for (let t = noon(start).getTime(); t <= noon(end).getTime(); t += DAY) {
    const key = dayKey(new Date(t));
    const count = counts.get(key) || 0;
    total += count;
    days.push({ key, label: shortDate(key), long: longDate(key), count, total });
  }
  return days;
}

// Clean axis maximum: 1-2-5 steps, at least 4.
function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
function ticks(max) {
  const step = max / 4;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 100) / 100);
}
function xTickIndices(n) {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i);
  const want = 6;
  const out = [];
  for (let i = 0; i < want; i++) out.push(Math.round((i * (n - 1)) / (want - 1)));
  return [...new Set(out)];
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setW(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ---------- one chart ---------- */
export function TimeChart({ days, field, kind, title, refLine, empty }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null); // index
  const H = 220;
  const M = { top: 14, right: 14, bottom: 30, left: 38 };
  const iw = Math.max(0, width - M.left - M.right);
  const ih = H - M.top - M.bottom;
  const n = days.length;
  const maxVal = Math.max(0, ...days.map((d) => d[field]), refLine?.value || 0);
  const yMax = niceMax(maxVal);
  const y = (v) => M.top + ih - (v / yMax) * ih;
  const slot = n ? iw / n : iw;
  const xc = (i) => M.left + slot * (i + 0.5);
  const barW = Math.min(24, Math.max(2, slot - 2));
  const xi = xTickIndices(n);
  const total = days.reduce((s, d) => s + d.count, 0);

  const onMove = (e) => {
    if (!n || !iw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - M.left;
    const i = Math.max(0, Math.min(n - 1, Math.floor(x / slot)));
    setHover(i);
  };
  const h = hover != null ? days[hover] : null;
  const tipLeft = h ? Math.min(Math.max(xc(hover) - 70, 0), Math.max(0, width - 150)) : 0;

  const path = useMemo(() => {
    if (!n) return "";
    return days.map((d, i) => `${i ? "L" : "M"}${xc(i).toFixed(1)},${y(d[field]).toFixed(1)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, field, width]);

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: INK.text }}>{title}</div>
        <div style={{ fontSize: 12, color: INK.faint, fontWeight: 600 }}>{n ? `${days[0].label} to ${days[n - 1].label}` : ""}</div>
      </div>
      <div ref={ref} style={{ position: "relative", width: "100%" }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label={title} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ display: "block", touchAction: "none" }}>
            {/* gridlines + y labels */}
            {ticks(yMax).map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK.faint} fontFamily="inherit">{Number.isInteger(t) ? t : ""}</text>
              </g>
            ))}
            {/* reference line */}
            {refLine && refLine.value > 0 && (
              <g>
                <line x1={M.left} x2={width - M.right} y1={y(refLine.value)} y2={y(refLine.value)} stroke={INK.axis} strokeWidth={1} />
                <text x={width - M.right} y={y(refLine.value) - 5} textAnchor="end" fontSize={11} fill={INK.sub} fontWeight={700} fontFamily="inherit">{refLine.label}</text>
              </g>
            )}
            {/* marks */}
            {kind === "bar" &&
              days.map((d, i) => {
                const v = d[field];
                if (!v) return null;
                const top = y(v);
                const bh = M.top + ih - top;
                const r = Math.min(4, bh);
                const x0 = xc(i) - barW / 2;
                return (
                  <path
                    key={d.key}
                    d={`M${x0},${M.top + ih} V${top + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${M.top + ih} Z`}
                    fill={SERIES}
                    opacity={hover == null || hover === i ? 1 : 0.55}
                  />
                );
              })}
            {kind === "line" && n > 0 && (
              <>
                <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {/* end value, direct label */}
                <circle cx={xc(n - 1)} cy={y(days[n - 1][field])} r={4} fill={SERIES} stroke="#fff" strokeWidth={2} />
                <text x={Math.min(xc(n - 1) + 8, width - M.right)} y={y(days[n - 1][field]) - 8} textAnchor={xc(n - 1) + 40 > width - M.right ? "end" : "start"} fontSize={12} fontWeight={800} fill={INK.text} fontFamily="inherit">
                  {days[n - 1][field]}
                </text>
              </>
            )}
            {/* crosshair */}
            {h && kind === "line" && (
              <>
                <line x1={xc(hover)} x2={xc(hover)} y1={M.top} y2={M.top + ih} stroke={INK.axis} strokeWidth={1} />
                <circle cx={xc(hover)} cy={y(h[field])} r={5} fill={SERIES} stroke="#fff" strokeWidth={2} />
              </>
            )}
            {/* x labels */}
            {xi.map((i) => (
              <text key={days[i].key} x={xc(i)} y={H - 10} textAnchor="middle" fontSize={11} fill={INK.faint} fontFamily="inherit">{days[i].label}</text>
            ))}
            {!total && kind === "bar" && (
              <text x={M.left + iw / 2} y={M.top + ih / 2} textAnchor="middle" fontSize={13} fill={INK.faint} fontFamily="inherit">{empty}</text>
            )}
          </svg>
        )}
        {h && (
          <div style={{ position: "absolute", top: 6, left: tipLeft, pointerEvents: "none", background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "7px 10px", boxShadow: "0 8px 24px -12px rgba(15,18,34,0.3)", minWidth: 140 }}>
            <div style={{ fontSize: 11.5, color: INK.sub, fontWeight: 700 }}>{h.long}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <span style={{ width: 12, height: 2, background: SERIES, borderRadius: 1, display: "inline-block" }} />
              <span style={{ fontSize: 15, fontWeight: 900, color: INK.text }}>{h[field]}</span>
              <span style={{ fontSize: 12, color: INK.sub }}>{field === "count" ? (h.count === 1 ? "new application" : "new applications") : "in total"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- table view ---------- */
export function DaysTable({ days }) {
  const rows = [...days].reverse();
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ color: INK.sub, fontSize: 12, textAlign: "left" }}>
            <th style={{ padding: "10px 16px", fontWeight: 800 }}>Day</th>
            <th style={{ padding: "10px 16px", fontWeight: 800, textAlign: "right" }}>New</th>
            <th style={{ padding: "10px 16px", fontWeight: 800, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.key} style={{ borderTop: `1px solid ${COLORS.border}`, color: d.count ? INK.text : INK.faint }}>
              <td style={{ padding: "8px 16px" }}>{d.long}</td>
              <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: d.count ? 800 : 500 }}>{d.count}</td>
              <td style={{ padding: "8px 16px", textAlign: "right" }}>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- stat tile ---------- */
export function Stat({ label, value, sub }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: INK.faint, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: INK.text, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: INK.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
