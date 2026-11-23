"use client";

// The card an AIDA chat sits in, with a full-screen mode.
// Normally it is a card in the page. With `full`, it covers the whole window under a slim bar that holds
// the title, "New chat" and "Exit full screen" (Esc does the same). The chat inside is the same element
// either way, so nothing typed or said is lost when switching.

import { useEffect } from "react";
import { Minimize2, RotateCcw } from "lucide-react";
import { COLORS } from "./ui";

const barButton = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: "7px 12px", fontSize: 13.5, fontWeight: 600, color: COLORS.ink, cursor: "pointer", fontFamily: "inherit" };

export default function ChatFrame({ full, onExit, title, onNew, children }) {
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    // the page behind does not scroll while the chat covers it
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [full, onExit]);

  const frame = full
    ? { position: "fixed", inset: 0, zIndex: 200, background: COLORS.surface, display: "flex", flexDirection: "column" }
    : { background: COLORS.surface, border: `1px solid ${COLORS.border}`, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(680px, 74vh)" };
  return (
    <div style={frame} data-chat-full={full ? "yes" : "no"}>
      {full && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink }}>{title}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {onNew && (
              <button type="button" onClick={onNew} style={barButton}>
                <RotateCcw size={15} /> New chat
              </button>
            )}
            <button type="button" onClick={onExit} style={barButton}>
              <Minimize2 size={15} /> Exit full screen
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
