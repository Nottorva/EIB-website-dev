"use client";

// The four student-facing deliverable inputs. Used for real in the lesson
// view and as a live "what students see" preview in the lesson editor.

import React, { useState } from "react";
import { uploadFile, downloadUrl } from "@/lib/uploadClient";
import { Plus, Trash2, Paperclip, FileText, CheckSquare, Square, Download } from "lucide-react";
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

// uploadPurpose: "deliverable" | "example" | "application" uploads for real;
// null keeps the file name only (used by the throwaway preview widget).
export function FileInput({ payload, onChange, uploadPurpose = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const link = downloadUrl(payload);

  const pick = async (f) => {
    if (!f) return;
    setError(null);
    if (!uploadPurpose) {
      onChange({ fileName: f.name, size: f.size, mimeType: f.type });
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadFile(f, uploadPurpose));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {payload?.fileName ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px", background: "#fbfbfd", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <FileText size={16} color={COLORS.indigo} />
            {link ? (
              <a href={link} style={{ fontSize: 14, fontWeight: 700, color: COLORS.indigo, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {payload.fileName}
              </a>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{payload.fileName}</span>
            )}
            {payload.size ? <span style={{ fontSize: 12, color: COLORS.faint }}>{Math.round(payload.size / 1024)} KB</span> : null}
          </div>
          <button type="button" onClick={() => onChange(null)} style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer", padding: 4 }}>
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.indigo}`, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 700, fontSize: 14, borderRadius: 12, padding: "12px 16px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
        <Paperclip size={15} />
        {busy ? "Uploading…" : payload?.fileName ? "Replace file" : "Choose a file to upload"}
        <input
          type="file"
          disabled={busy}
          style={{ display: "none" }}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && <div style={{ fontSize: 12.5, color: COLORS.red, fontWeight: 700, marginTop: 8 }}>{error}</div>}
      {!uploadPurpose && <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 8 }}>Preview only: nothing is uploaded here.</div>}
    </div>
  );
}

/* ---------- Read-only rendering of a payload (submissions and examples) ---------- */
export function isPayloadEmpty(type, payload) {
  if (!payload) return true;
  if (type === "text") return !String(payload.text || "").trim();
  if (type === "table") return !(payload.rows || []).some((r) => r.some((c) => String(c || "").trim()));
  if (type === "checklist") return !(payload.items || []).some((i) => i.checked);
  if (type === "file") return !payload.fileName;
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

  if (type === "file") {
    const link = downloadUrl(payload);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", background: "#fbfbfd" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <FileText size={15} color={COLORS.indigo} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{payload.fileName}</span>
          {payload.size ? <span style={{ fontSize: 12, color: COLORS.faint }}>{Math.round(payload.size / 1024)} KB</span> : null}
        </div>
        {link ? (
          <a href={link} title="Download" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 800, color: COLORS.indigo, textDecoration: "none", whiteSpace: "nowrap" }}>
            <Download size={14} /> Download
          </a>
        ) : (
          <span style={{ fontSize: 12, color: COLORS.faint }}>name only</span>
        )}
      </div>
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

export const INPUT_FOR_TYPE = { text: TextInput, table: TableInput, checklist: ChecklistInput, file: FileInput };

export function DeliverableInput({ item, payload, onChange, uploadPurpose = null }) {
  const Input = INPUT_FOR_TYPE[item.type] || TextInput;
  return <Input item={item} payload={payload} onChange={onChange} uploadPurpose={uploadPurpose} />;
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
