"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
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
  Check,
  Loader2,
} from "lucide-react";

/* ---------- Design tokens (shared by every EIB tool) ---------- */
export const COLORS = {
  bg: "#f7f8fb",
  card: "#ffffff",
  border: "#eef1f6",
  text: "#0f1222",
  sub: "#64748b",
  faint: "#6b7280", // 4.8:1 on white, 4.5:1 on the page background
  indigo: "#4f46e5",
  indigoSoft: "#eef0ff",
  indigoBorder: "#dcdcff",
  amber: "#b45309",
  amberSoft: "#fdf3e0",
  amberBorder: "#f3dfb0",
  red: "#dc2626",
  redSoft: "#fef2f2",
  redBorder: "#fbd5d5",
  green: "#15803d",
  greenSoft: "#ecfdf5",
  greenBorder: "#bbf0d3",
};

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

/* ---------- Editable primitives ---------- */
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
      style={{
        border: `1px solid ${focused ? COLORS.indigo : "transparent"}`,
        borderRadius: 8,
        padding: "3px 7px",
        margin: "-3px -7px",
        background: focused ? "#fff" : "transparent",
        fontFamily: "inherit",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
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
      style={{
        border: `1px solid ${focused ? COLORS.indigo : "transparent"}`,
        borderRadius: 8,
        padding: "6px 8px",
        margin: "-6px -8px",
        background: focused ? "#fff" : "transparent",
        fontFamily: "inherit",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        resize: "none",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}

export const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  color: COLORS.text,
  background: "#fff",
};

export function FieldLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: COLORS.text,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: COLORS.indigo,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */
export function Pill({ icon: Icon, label, tone = "outline", onClick, style }) {
  const tones = {
    default: { background: COLORS.indigo, color: "#fff", border: "none" },
    outline: { background: "#fff", color: COLORS.text, border: `1px solid ${COLORS.border}` },
    amber: { background: COLORS.amberSoft, color: COLORS.amber, border: `1px solid ${COLORS.amberBorder}` },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "13px 20px",
        borderRadius: 12,
        fontSize: 15.5,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        ...tones[tone],
        ...style,
      }}
    >
      {Icon && <Icon size={18} strokeWidth={2.25} />}
      {label}
    </button>
  );
}

export function HeaderButton({ icon: Icon, label, onClick, tone = "default", href }) {
  const tones = {
    default: { background: COLORS.indigo, color: "#fff" },
    danger: { background: COLORS.redSoft, color: COLORS.red },
  };
  const style = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderRadius: 12,
    padding: "11px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
    ...tones[tone],
  };
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={style}>
        {Icon && <Icon size={17} strokeWidth={2.25} />}
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {Icon && <Icon size={17} strokeWidth={2.25} />}
      {label}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled, icon: Icon, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        border: "none",
        background: disabled ? "#d7dbe4" : COLORS.indigo,
        color: "#fff",
        fontWeight: 800,
        fontSize: 14,
        borderRadius: 10,
        padding: "10px 16px",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        ...style,
      }}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, onClick, title, color = COLORS.faint, size = 16, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        border: "none",
        background: "transparent",
        color: disabled ? "#d7dbe4" : color,
        cursor: disabled ? "default" : "pointer",
        padding: 4,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Icon size={size} />
    </button>
  );
}

export function SegmentedTabs({ value, onChange, options, style }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        background: "#f7f8fb",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 11,
        padding: 4,
        ...style,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontSize: 13.5,
              fontWeight: 800,
              color: active ? "#fff" : COLORS.sub,
              background: active ? COLORS.indigo : "transparent",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {Icon && <Icon size={15} />}
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
        fontWeight: 800,
        color: status.color,
        background: status.soft,
        border: `1px solid ${status.border}`,
        borderRadius: 999,
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
        fontSize: 12.5,
        fontWeight: 800,
        color: s.color,
        background: s.soft,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
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
        <button
          type="button"
          onClick={() => setFilter("all")}
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: filter === "all" ? "#fff" : COLORS.text,
            background: filter === "all" ? COLORS.indigo : "#fff",
            border: `1px solid ${filter === "all" ? COLORS.indigo : COLORS.border}`,
            borderRadius: 999,
            padding: "6px 13px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          All
        </button>
        {statuses.map((s) => {
          const active = filter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(s.id)}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: active ? "#fff" : s.color,
                background: active ? s.color : s.soft,
                border: `1px solid ${active ? s.color : s.border}`,
                borderRadius: 999,
                padding: "6px 13px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <Search size={14} color={COLORS.faint} style={{ position: "absolute", left: 10, top: 10 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "7px 12px 7px 30px",
            fontSize: 13.5,
            outline: "none",
            width: Math.max(170, placeholder.length * 7 + 44),
            fontFamily: "inherit",
          }}
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
        borderRadius: 999,
        background: COLORS.indigoSoft,
        color: COLORS.indigo,
        fontWeight: 800,
        fontSize: size >= 44 ? 16 : 13,
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

export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
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
  return <div style={{ textAlign: "center", color: COLORS.faint, fontSize: 14, padding: "30px 0" }}>{children}</div>;
}

export function Notice({ tone = "error", children, onClose }) {
  const tones = {
    error: { bg: COLORS.redSoft, border: COLORS.redBorder, color: COLORS.red },
    info: { bg: COLORS.indigoSoft, border: COLORS.indigoBorder, color: COLORS.indigo },
    amber: { bg: COLORS.amberSoft, border: COLORS.amberBorder, color: COLORS.amber },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        borderRadius: 12,
        padding: "11px 14px",
        fontSize: 13.5,
        fontWeight: 700,
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ border: "none", background: "transparent", color: t.color, cursor: "pointer", padding: 0 }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function SaveIndicator({ status }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: Loader2, label: "Saving…", color: COLORS.faint },
    saved: { icon: Check, label: "Saved", color: COLORS.green },
    error: { icon: AlertCircle, label: "Save failed", color: COLORS.red },
  };
  const m = map[status];
  if (!m) return null;
  const Icon = m.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 800, color: m.color }}>
      <Icon size={13} className={status === "saving" ? "eib-spin" : undefined} />
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
      <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{right}</div>
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.faint, fontSize: 14, fontWeight: 700, padding: "40px 0", justifyContent: "center" }}>
      <Loader2 size={16} className="eib-spin" /> {label}
    </div>
  );
}

/* ---------- Modal shell ---------- */
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
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,34,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 120 }}
    >
      <div role="alertdialog" aria-modal="true" style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460, padding: "26px 28px", boxShadow: "0 20px 60px rgba(15,23,42,0.25)", boxSizing: "border-box" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.red, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{note || "This cannot be undone"}</div>
        <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, lineHeight: 1.25 }}>{title}</div>
        {body && <div style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.55, marginTop: 10 }}>{body}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onDone(false)} autoFocus style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (armed ? onDone(true) : setArmed(true))}
            style={{ border: `1px solid ${armed ? COLORS.red : COLORS.redBorder}`, background: armed ? COLORS.red : COLORS.redSoft, color: armed ? "#fff" : COLORS.red, fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
          >
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,18,34,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        zIndex: 100,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          width: "100%",
          maxWidth,
          padding: "32px 36px 36px",
          boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {eyebrow}
            </div>
            <div style={{ fontSize: 27, fontWeight: 800, color: COLORS.text }}>{title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: COLORS.text,
              }}
            >
              <X size={18} />
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
        fontWeight: 800,
        color: COLORS.indigo,
        background: COLORS.indigoSoft,
        borderRadius: 999,
        padding: "3px 10px",
        marginBottom: 8,
        textTransform: uppercase ? "uppercase" : "none",
        letterSpacing: 0.3,
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {info.label}
      {points !== null && points !== undefined && points !== "" ? ` · ${points} pts` : ""}
    </span>
  );
}
