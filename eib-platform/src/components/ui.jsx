"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Type as TypeIcon,
  AlignLeft,
  ListChecks,
  Paperclip,
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
  faint: "#94a3b8",
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
  { id: "file", label: "File Upload", icon: Paperclip },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];
export const deliverableType = (id) => DELIVERABLE_TYPES.find((t) => t.id === id) || DELIVERABLE_TYPES[0];

export const QUESTION_TYPES = [
  { id: "short", label: "Short Answer", icon: TypeIcon },
  { id: "long", label: "Long Answer", icon: AlignLeft },
  { id: "choice", label: "Multiple Choice", icon: ListChecks },
  { id: "file", label: "File Upload", icon: Paperclip },
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

export function EditableTextarea({ value, onChange, placeholder, style, rows = 3 }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
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
        resize: "vertical",
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

export function FilterBar({ filter, setFilter, statuses, search, setSearch, right }) {
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
          placeholder="Search name"
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "7px 12px 7px 30px",
            fontSize: 13.5,
            outline: "none",
            width: 170,
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

/* ---------- Slide viewer (placeholder deck) ---------- */
export function SlideViewer({ slides }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const navBtnStyle = (disabled) => ({
    width: 42,
    height: 42,
    borderRadius: 11,
    border: `1px solid ${COLORS.border}`,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    color: COLORS.text,
  });
  return (
    <>
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 18, overflow: "hidden" }}>
        <div style={{ height: 6, background: COLORS.indigo }} />
        <div style={{ padding: "44px 40px", minHeight: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.5, marginBottom: 18 }}>SLIDE {index + 1}</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>{slide.title}</div>
          <div style={{ fontSize: 19, color: COLORS.sub }}>{slide.subtitle}</div>
          <div style={{ marginTop: 60 }}>
            <div style={{ width: 60, height: 3, background: COLORS.indigoSoft, borderRadius: 2, marginBottom: 14 }} />
            <div style={{ fontSize: 13.5, color: COLORS.faint, fontWeight: 600 }}>EIB · Nemosyne</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 22 }}>
        <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} style={navBtnStyle(index === 0)}>
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={index === slides.length - 1}
          style={navBtnStyle(index === slides.length - 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </>
  );
}

/* ---------- Deliverable type chip ---------- */
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
