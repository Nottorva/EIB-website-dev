"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import {
  X,
  Search,
  Type as TypeIcon,
  AlignLeft,
  ListChecks,
  Link2,
  Megaphone,
  Table as TableIcon,
  CheckSquare,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Check,
  Loader2,
} from "lucide-react";

/* ---------- Design tokens (shared by every EIB tool) ---------- */
// The values live in src/lib/tokens.js (and as CSS variables in globals.css).
import { COLORS, TOKENS, FONTS } from "@/lib/tokens";
export { COLORS, TOKENS, FONTS };

export const DELIVERABLE_TYPES = [
  { id: "text", label: "Text Response", icon: TypeIcon },
  { id: "link", label: "Link", icon: Link2 },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];
export const deliverableType = (id) => DELIVERABLE_TYPES.find((t) => t.id === id) || DELIVERABLE_TYPES[0];

export const QUESTION_TYPES = [
  { id: "short", label: "Short Answer", icon: TypeIcon },
  { id: "long", label: "Long Answer", icon: AlignLeft },
  { id: "choice", label: "Multiple Choice", icon: ListChecks },
  { id: "link", label: "Link", icon: Link2 },
  { id: "notice", label: "Notice", icon: Megaphone },
];
export const questionType = (id) => QUESTION_TYPES.find((t) => t.id === id) || QUESTION_TYPES[0];

export function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

let uid = 1000;
export const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}${(uid++).toString(36)}`;

const cx = (...parts) => parts.filter(Boolean).join(" ");

/* ---------- Editable primitives ---------- */
// Looks like plain text until focused; the negative margin keeps the text
// where it was when the border and padding appear.
const editableStyle = (focused, y, x) => ({
  border: `1px solid ${focused ? TOKENS.ink : "transparent"}`,
  borderRadius: 0,
  padding: `${y}px ${x}px`,
  margin: `-${y}px -${x}px`,
  background: focused ? TOKENS.surface : "transparent",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
});
export function EditableInput({ value, onChange, placeholder, style, type = "text" }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...editableStyle(focused, 3, 7), ...style }}
    />
  );
}

// Grows with its content (no inner scrollbar); `rows` is only the minimum height.
export function EditableTextarea({ value, onChange, placeholder, style, rows = 3 }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...editableStyle(focused, 6, 8), resize: "none", overflow: "hidden", ...style }}
    />
  );
}

// Inputs: surface ground, 1px border-2, 16px text, 44px tall. The focus look
// (ink border plus ink ring) comes from globals.css.
export const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${TOKENS.border2}`,
  borderRadius: 0,
  padding: "10px 14px",
  minHeight: 44,
  fontSize: 16,
  lineHeight: 1.5,
  fontFamily: "inherit",
  color: TOKENS.ink,
  background: TOKENS.surface,
};

/* ---------- Type ---------- */
export function FieldLabel({ children, style }) {
  return (
    <div className="eib-label" style={{ marginBottom: 8, ...style }}>
      {children}
    </div>
  );
}

// The eyebrow label: small, uppercase, widely spaced, in ink.
export function SectionLabel({ children, style }) {
  return (
    <div className="eib-eyebrow" style={{ marginBottom: 14, ...style }}>
      {children}
    </div>
  );
}
export const Eyebrow = SectionLabel;

export function H1({ children, style }) {
  return (
    <h1 className="eib-h1" style={style}>
      {children}
    </h1>
  );
}

export function H2({ children, style }) {
  return (
    <h2 className="eib-h2" style={style}>
      {children}
    </h2>
  );
}

export function TextLink({ href, children, style, ...rest }) {
  return (
    <a href={href} className="eib-link" style={style} {...rest}>
      {children}
    </a>
  );
}

/* ---------- Layout ---------- */
// The page container: 1040px wide, centred, 24px between blocks.
export function PageShell({ children, style }) {
  return (
    <div className="eib-page" style={style}>
      {children}
    </div>
  );
}

// A section of a page: surface ground, 1px border, roomy padding.
export function Section({ children, style, eyebrow, title }) {
  return (
    <section className="eib-card" style={style}>
      {eyebrow && <Eyebrow style={{ marginBottom: 10 }}>{eyebrow}</Eyebrow>}
      {title && <H2 style={{ marginBottom: 18 }}>{title}</H2>}
      {children}
    </section>
  );
}

// One per page, for the most important thing on it: a section with a brass
// frame set 12px inside the edge and a short brass rule under its heading.
export function FeatureCard({ children, style, eyebrow, title }) {
  return (
    <section className="eib-card eib-card--feature" style={style}>
      {eyebrow && <Eyebrow style={{ marginBottom: 10 }}>{eyebrow}</Eyebrow>}
      {title && (
        <>
          <H2>{title}</H2>
          <hr className="eib-rule" />
        </>
      )}
      {children}
    </section>
  );
}

// Main column plus a side column; stacks on a phone.
export function TwoColumn({ main, side, style }) {
  return (
    <div className="eib-split" style={style}>
      <div className="eib-split-main">{main}</div>
      <div className="eib-split-side">{side}</div>
    </div>
  );
}

// Key/value data: items = [{ label, value }].
export function KeyValue({ items, style }) {
  return (
    <dl className="eib-kv" style={style}>
      {items.map((it) => (
        <div key={it.label}>
          <dt className="eib-label">{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Buttons ---------- */
export function Pill({ icon: Icon, label, tone = "outline", onClick, style }) {
  const tones = { default: "", outline: "eib-btn--secondary", amber: "eib-btn--warn" };
  return (
    <button type="button" onClick={onClick} className={cx("eib-btn", tones[tone])} style={{ display: "flex", ...style }}>
      {Icon && <Icon size={18} strokeWidth={2} />}
      {label}
    </button>
  );
}

export function HeaderButton({ icon: Icon, label, onClick, tone = "default", href }) {
  const tones = { default: "", danger: "eib-btn--danger", soft: "eib-btn--secondary" };
  const className = cx("eib-btn", tones[tone]);
  const style = { display: "flex" };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} style={style}>
        {Icon && <Icon size={18} strokeWidth={2} />}
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {Icon && <Icon size={18} strokeWidth={2} />}
      {label}
    </button>
  );
}

// variant: "primary" (ink), "secondary" (surface, ink border) or "tertiary"
// (transparent, quiet border). size "sm" is for rows and toolbars.
export function PrimaryButton({ children, onClick, disabled, icon: Icon, style, type = "button", variant = "primary", size }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx("eib-btn", variant !== "primary" && `eib-btn--${variant}`, size === "sm" && "eib-btn--sm")}
      style={{ display: "flex", ...style }}
    >
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </button>
  );
}
export function SecondaryButton(props) {
  return <PrimaryButton {...props} variant="secondary" />;
}
export function TertiaryButton(props) {
  return <PrimaryButton {...props} variant="tertiary" />;
}

export function IconButton({ icon: Icon, onClick, title, color = COLORS.muted, size = 16, disabled }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} disabled={disabled} className="eib-iconbtn" style={{ color: disabled ? TOKENS.disabled : color }}>
      <Icon size={size} strokeWidth={2} />
    </button>
  );
}

export function SegmentedTabs({ value, onChange, options, style }) {
  return (
    <div className="eib-tabs" style={style}>
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)} aria-pressed={value === opt.id} className="eib-tab">
            {Icon && <Icon size={16} strokeWidth={2} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Status chips ---------- */
export function StatusBadge({ status, size = "md" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: size === "sm" ? 12 : 13,
        fontWeight: 600,
        color: status.color,
        background: status.soft,
        border: `1px solid ${status.border}`,
        borderRadius: 0,
        padding: size === "sm" ? "3px 9px" : "5px 12px",
        whiteSpace: "nowrap",
      }}
    >
      {status.label}
    </span>
  );
}

export function StatusDropdown({ value, onChange, statuses }) {
  const s = statuses.find((x) => x.id === value) || statuses[0];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: s.color,
        background: s.soft,
        border: `1px solid ${s.border}`,
        borderRadius: 0,
        padding: "5px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {statuses.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function FilterBar({ filter, setFilter, statuses, search, setSearch, right, placeholder = "Search name" }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", label: "All", color: TOKENS.ink, ink: TOKENS.ink, soft: TOKENS.surface, border: TOKENS.border2 }, ...statuses].map((s) => {
          const active = filter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(s.id)}
              aria-pressed={active}
              className="eib-chip"
              style={{
                color: active ? "#fff" : s.ink || s.color,
                background: active ? s.color : s.soft,
                border: `1px solid ${active ? s.color : s.border}`,
                fontWeight: active ? 600 : 500,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <Search size={16} strokeWidth={2} color={TOKENS.muted} style={{ position: "absolute", left: 12, top: 14 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{ ...fieldStyle, padding: "8px 12px 8px 36px", fontSize: 15, width: Math.max(190, placeholder.length * 8 + 52) }}
        />
      </div>
      {right}
    </div>
  );
}

export function Avatar({ name, size = 36 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        background: TOKENS.bg,
        border: `1px solid ${TOKENS.border2}`,
        color: TOKENS.ink,
        fontWeight: 600,
        fontSize: size >= 44 ? 16 : 13,
        letterSpacing: "0.04em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

// A compact card for lists and rows. Page sections use <Section>.
export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 0,
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div style={{ textAlign: "center", color: TOKENS.muted, fontSize: 14, padding: "30px 0" }}>{children}</div>;
}

// The status banner. tone: "success", "neutral" (also "info"), "error" or
// "amber" (a warning). `lead` is the bold lead-in sentence.
export function Notice({ tone = "error", lead, children, onClose, style }) {
  const neutral = { bg: TOKENS.surface, border: TOKENS.border, color: TOKENS.muted, iconColor: TOKENS.muted, icon: Info };
  const tones = {
    success: { bg: TOKENS.successBg, border: TOKENS.successBorder, color: TOKENS.successText, iconColor: TOKENS.successIcon, icon: CheckCircle2 },
    error: { bg: TOKENS.errorBg, border: TOKENS.errorBorder, color: TOKENS.errorText, iconColor: TOKENS.errorIcon, icon: AlertCircle },
    amber: { bg: TOKENS.warnBg, border: TOKENS.warnBorder, color: TOKENS.warnText, iconColor: TOKENS.warnIcon, icon: AlertTriangle },
    neutral,
    info: neutral,
  };
  const t = tones[tone] || neutral;
  const Icon = t.icon;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        borderRadius: 0,
        padding: "14px 18px",
        fontSize: 15,
        marginBottom: 14,
        lineHeight: 1.5,
        ...style,
      }}
    >
      <Icon size={18} strokeWidth={2} color={t.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {lead && <strong style={{ fontWeight: 600 }}>{lead} </strong>}
        {children}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="eib-iconbtn" style={{ color: t.color, padding: 0, marginTop: 2 }}>
          <X size={18} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
export const Banner = Notice;

export function SaveIndicator({ status }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: Loader2, label: "Saving…", color: TOKENS.muted },
    saved: { icon: Check, label: "Saved", color: TOKENS.successText },
    error: { icon: AlertCircle, label: "Save failed", color: TOKENS.errorText },
  };
  const m = map[status];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: m.color }}>
      <Icon size={16} strokeWidth={2} className={status === "saving" ? "eib-spin" : undefined} />
      {m.label}
    </span>
  );
}

export function PageTitle({ title, right, style }) {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div className="eib-h2">{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{right}</div>
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: TOKENS.muted, fontSize: 14, padding: "40px 0", justifyContent: "center" }}>
      <Loader2 size={18} strokeWidth={2} className="eib-spin" /> {label}
    </div>
  );
}

/* ---------- Modal shell ---------- */
// No shadow: the dialog is a surface with an ink border over a dimmed page.
const overlayStyle = { position: "fixed", inset: 0, background: TOKENS.scrim, display: "flex", justifyContent: "center" };
const dialogStyle = { background: TOKENS.surface, border: `1px solid ${TOKENS.ink}`, borderRadius: 0, width: "100%", boxSizing: "border-box" };

// Two-step confirmation for anything destructive. Usage:
//   const [confirmDanger, confirmUI] = useDangerConfirm();
//   if (!(await confirmDanger({ title, body, label }))) return;   ...and render {confirmUI}
// The first click on the red button arms it; only a second click confirms.
export function useDangerConfirm() {
  const [req, setReq] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setReq({ ...opts, resolve })), []);
  const done = useCallback(
    (ok) => {
      setReq((r) => {
        if (r) r.resolve(ok);
        return null;
      });
    },
    []
  );
  const ui = req ? <DangerConfirm title={req.title} body={req.body} label={req.label} note={req.note} onDone={done} /> : null;
  return [confirm, ui];
}

// `note` replaces the "cannot be undone" line for actions that can be reversed.
function DangerConfirm({ title, body, label = "Delete", note, onDone }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onDone(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDone(false);
      }}
      style={{ ...overlayStyle, alignItems: "center", padding: 20, zIndex: 120 }}
    >
      <div role="alertdialog" aria-modal="true" className="eib-modal" style={{ ...dialogStyle, maxWidth: 480, padding: "32px 36px" }}>
        <div className="eib-label" style={{ color: TOKENS.errorText, fontWeight: 600, marginBottom: 8 }}>
          {note || "This cannot be undone"}
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 28, fontWeight: 600, color: TOKENS.ink, lineHeight: 1.2 }}>{title}</div>
        {body && <div style={{ fontSize: 15, color: TOKENS.text2, lineHeight: 1.6, marginTop: 12 }}>{body}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onDone(false)} autoFocus className="eib-btn eib-btn--tertiary">
            Cancel
          </button>
          <button type="button" onClick={() => (armed ? onDone(true) : setArmed(true))} className={cx("eib-btn", armed ? "eib-btn--danger-armed" : "eib-btn--danger")}>
            {armed ? "Are you sure? Click again to confirm" : label}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalShell({ eyebrow, title, onClose, children, headerRight, maxWidth = 760 }) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ ...overlayStyle, alignItems: "flex-start", padding: "40px 20px", zIndex: 100, overflowY: "auto" }}
    >
      <div className="eib-modal" style={{ ...dialogStyle, maxWidth, padding: "36px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="eib-eyebrow" style={{ marginBottom: 8 }}>
              {eyebrow}
            </div>
            <div className="eib-h2">{title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {headerRight}
            <button type="button" onClick={onClose} aria-label="Close" className="eib-btn eib-btn--tertiary" style={{ width: 44, minHeight: 44, padding: 0 }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TypeChip({ type, points, uppercase = false }) {
  const info = deliverableType(type);
  const Icon = info.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: TOKENS.ink,
        background: TOKENS.bg,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 0,
        padding: "3px 10px",
        marginBottom: 8,
        textTransform: uppercase ? "uppercase" : "none",
        letterSpacing: uppercase ? "0.12em" : 0,
      }}
    >
      <Icon size={13} strokeWidth={2} />
      {info.label}
      {points !== null && points !== undefined && points !== "" ? ` · ${points} pts` : ""}
    </span>
  );
}
