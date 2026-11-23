// What a student sees on the Lessons page between signing up and the super
// admin pressing "Start class": their seat is held, there is nothing to do yet.

import { CalendarClock } from "lucide-react";
import { COLORS } from "./ui";

export default function ClassOnHold({ user }) {
  const first = (user.name || "").split(" ")[0];
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "60px 20px 80px" }}>
      <main style={{ maxWidth: 560, margin: "0 auto", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 32, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: COLORS.indigoSoft, color: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CalendarClock size={26} strokeWidth={2.25} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: COLORS.text, margin: "0 0 10px" }}>Your seat is saved{first ? `, ${first}` : ""}</h1>
        <p style={{ fontSize: 15.5, color: COLORS.sub, lineHeight: 1.6, margin: 0 }}>
          Class has not started yet. There is nothing else to do for now: your lessons will open here, on this page, as soon as the class starts.
        </p>
      </main>
    </div>
  );
}
