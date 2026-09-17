"use client";

// The four student-facing deliverable inputs. Used for real in the lesson
// view and as a live "what students see" preview in the lesson editor.

import React, { useState } from "react";
import { Plus, Trash2, CheckSquare, Square, ExternalLink, Link2 } from "lucide-react";
import { COLORS } from "./ui";

const inputBox = {
  width: "100%",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: "14px 16px",
  fontSize: 14.5,
  color: COLORS.text,
  boxSizing: "border-box",
  background: "#fbfbfd",
  outline: "none",
};

export function TextInput({ item, payload, onChange }) {
  return (
    <textarea
      value={payload?.text || ""}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder={item.example?.text ? item.example.text : "Write your response here..."}
      rows={4}
      style={{ ...inputBox, resize: "vertical" }}
    />
  );
}

// Columns come from the deliverable. If the deliverable also names rows, the
// table is fixed-size with a read-only label column; otherwise students add
// and remove rows themselves.
export function TableInput({ item, payload, onChange }) {
  const columns = item.columns?.length ? item.columns : ["Column 1", "Column 2"];
  const rowLabels = item.rowLabels?.length ? item.rowLabels : [];
  const fixed = rowLabels.length > 0;
  const rows = fixed
    ? rowLabels.map((_, i) => payload?.rows?.[i] || columns.map(() => ""))
    : payload?.rows?.length
      ? payload.rows
      : [columns.map(() => "")];
  const commit = (nextRows) => onChange({ columns, rowLabels, rows: nextRows });

  const th = { textAlign: "left", fontSize: 12, fontWeight: 800, color: COLORS.indigo, background: COLORS.indigoSoft, padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}` };
  const cellStyle = { border: "none", background: "transparent", padding: "8px 10px", fontSize: 13.5, color: COLORS.text, width: "100%", outline: "none", boxSizing: "border-box", minWidth: 90 };

  return (
    <div>
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "auto", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {fixed && <th style={{ ...th, width: "22%" }} />}
              {columns.map((c, i) => (
                <th key={i} style={th}>
                  {c}
                </th>
              ))}
              {!fixed && <th style={{ ...th, width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {fixed && (
                  <td style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "8px 12px", fontSize: 13, fontWeight: 800, color: COLORS.sub, background: "#fbfbfd", verticalAlign: "top" }}>
                    {rowLabels[ri]}
                  </td>
                )}
                {columns.map((_, ci) => (
                  <td key={ci} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: 0 }}>
                    <input
                      value={row[ci] || ""}
                      onChange={(e) => {
                        const next = rows.map((r) => [...r]);
                        next[ri][ci] = e.target.value;
                        commit(next);
                      }}
                      style={cellStyle}
                    />
                  </td>
                ))}
                {!fixed && (
                  <td style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                    <button type="button" onClick={() => commit(rows.filter((_, i) => i !== ri))} disabled={rows.length === 1} style={{ border: "none", background: "transparent", color: rows.length === 1 ? "#d7dbe4" : COLORS.faint, cursor: rows.length === 1 ? "default" : "pointer", padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!fixed && (
        <button type="button" onClick={() => commit([...rows, columns.map(() => "")])} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "8px 0 0" }}>
          <Plus size={14} /> Add row
        </button>
      )}
    </div>
  );
}

export function ChecklistInput({ item, payload, onChange }) {
  const labels = item.checklistItems?.length ? item.checklistItems : [];
  const items = labels.map((label) => ({ label, checked: Boolean(payload?.items?.find((p) => p.label === label)?.checked) }));
  if (labels.length === 0) return <div style={{ fontSize: 14, color: COLORS.faint, fontStyle: "italic" }}>No checklist items have been defined for this deliverable yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange({ items: items.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) })}
          style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${it.checked ? COLORS.indigoBorder : COLORS.border}`, borderRadius: 10, padding: "10px 12px", background: it.checked ? COLORS.indigoSoft : "#fff", cursor: "pointer", textAlign: "left" }}
        >
          {it.checked ? <CheckSquare size={16} color={COLORS.indigo} strokeWidth={2.5} /> : <Square size={16} color={COLORS.faint} strokeWidth={2.25} />}
          <span style={{ fontSize: 14, fontWeight: 600, color: it.checked ? COLORS.text : COLORS.sub }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export function isValidUrl(v) {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// A link to work that lives elsewhere (Google Docs, Slides, Canva, Drive...).
// Payload: { url }.
export function LinkInput({ payload, onChange }) {
  const url = payload?.url || "";
  const valid = url === "" || isValidUrl(url);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Link2 size={15} color={COLORS.faint} style={{ position: "absolute", left: 14, top: 16 }} />
          <input
            type="url"
            value={url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://docs.google.com/..."
            style={{ ...inputBox, paddingLeft: 38, borderColor: valid ? COLORS.border : COLORS.redBorder }}
          />
        </div>
        {isValidUrl(url) && (
          <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#fff", background: COLORS.indigo, fontWeight: 700, textDecoration: "none", borderRadius: 12, padding: "13px 16px", whiteSpace: "nowrap" }}>
            Open <ExternalLink size={14} />
          </a>
        )}
      </div>
      <div style={{ fontSize: 12, color: valid ? COLORS.faint : COLORS.red, marginTop: 8 }}>
        {valid ? "Make sure the link is shared so anyone with it can view." : "That does not look like a web address. It should start with https://"}
      </div>
    </div>
  );
}

/* ---------- Read-only rendering of a payload (submissions and examples) ---------- */
export function isPayloadEmpty(type, payload) {
  if (!payload) return true;
  if (type === "text") return !String(payload.text || "").trim();
  if (type === "table") return !(payload.rows || []).some((r) => r.some((c) => String(c || "").trim()));
  if (type === "checklist") return !(payload.items || []).some((i) => i.checked);
  if (type === "link") return !isValidUrl(payload.url);
  return true;
}

export function PayloadView({ type, payload, emptyLabel = "Not submitted yet." }) {
  if (isPayloadEmpty(type, payload) && type !== "checklist") {
    return (
      <div style={{ border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, fontWeight: 600, color: COLORS.faint, fontStyle: "italic" }}>
        {emptyLabel}
      </div>
    );
  }

  if (type === "text") {
    return (
      <div style={{ background: "#fbfbfd", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, color: COLORS.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {payload.text}
      </div>
    );
  }

  if (type === "table") {
    const columns = payload.columns || [];
    const rows = payload.rows || [];
    const rowLabels = payload.rowLabels || [];
    const th = { textAlign: "left", fontSize: 12, fontWeight: 800, color: COLORS.indigo, background: COLORS.indigoSoft, padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}` };
    return (
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "auto", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {rowLabels.length > 0 && <th style={th} />}
              {columns.map((c, i) => (
                <th key={i} style={th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const last = ri === rows.length - 1;
              return (
                <tr key={ri}>
                  {rowLabels.length > 0 && (
                    <td style={{ fontSize: 13, fontWeight: 800, color: COLORS.sub, background: "#fbfbfd", padding: "8px 12px", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>{rowLabels[ri]}</td>
                  )}
                  {columns.map((_, ci) => (
                    <td key={ci} style={{ fontSize: 13.5, color: COLORS.text, padding: "8px 12px", borderBottom: last ? "none" : `1px solid ${COLORS.border}` }}>
                      {row[ci] || ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "checklist") {
    const items = payload?.items || [];
    if (items.length === 0) return <div style={{ fontSize: 13.5, color: COLORS.faint, fontStyle: "italic" }}>{emptyLabel}</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 12px", background: item.checked ? COLORS.indigoSoft : "#fff" }}>
            {item.checked ? <CheckSquare size={15} color={COLORS.indigo} strokeWidth={2.5} /> : <Square size={15} color={COLORS.faint} strokeWidth={2.25} />}
            <span style={{ fontSize: 13.5, fontWeight: 600, color: item.checked ? COLORS.text : COLORS.sub }}>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "link") {
    return (
      <a
        href={payload.url}
        target="_blank"
        rel="noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", background: "#fbfbfd", textDecoration: "none", minWidth: 0 }}
      >
        <Link2 size={15} color={COLORS.indigo} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.indigo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{payload.url}</span>
        <ExternalLink size={14} color={COLORS.faint} />
      </a>
    );
  }
  return null;
}

// "Example" block used wherever a deliverable's example is shown.
export function ExampleBlock({ item }) {
  const empty = isPayloadEmpty(item.type, item.example);
  return (
    <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Example</div>
      {empty ? <div style={{ fontSize: 14, color: COLORS.faint, fontStyle: "italic" }}>No example added yet.</div> : <PayloadView type={item.type} payload={item.example} />}
    </div>
  );
}

export const INPUT_FOR_TYPE = { text: TextInput, table: TableInput, checklist: ChecklistInput, link: LinkInput };

export function DeliverableInput({ item, payload, onChange }) {
  const Input = INPUT_FOR_TYPE[item.type] || TextInput;
  return <Input item={item} payload={payload} onChange={onChange} />;
}

// Editor-side preview: the real input, wired to throwaway local state, so the
// author can click the checkboxes and type in the table exactly as a student
// would. Nothing here is saved.
export function DeliverablePreview({ item }) {
  const [payload, setPayload] = useState(null);
  return (
    <div style={{ border: `1px dashed ${COLORS.indigoBorder}`, background: "#fbfbfd", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.4 }}>Student preview · interactive, not saved</div>
        {payload && (
          <button type="button" onClick={() => setPayload(null)} style={{ border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
            Reset
          </button>
        )}
      </div>
      {item.instructions && <div style={{ fontSize: 14, color: COLORS.sub, lineHeight: 1.55, marginBottom: 12 }}>{item.instructions}</div>}
      <DeliverableInput item={item} payload={payload} onChange={setPayload} />
    </div>
  );
}
