// How to pay the program fee: shown once the Student Agreement is signed, to
// the student and to a parent who signed up for them. The link and the words
// are set on the Student Manager's Student agreement tab; the super admin
// ticks "paid" on the student once the money has arrived.

import { CreditCard, CircleCheck, ExternalLink } from "lucide-react";
import { COLORS } from "./ui";

export default function PaymentCard({ payment, paid }) {
  if (paid) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.successBg, border: `1px solid ${COLORS.successBorder}`, padding: "14px 18px", marginTop: 16, fontSize: 14.5, fontWeight: 600, color: COLORS.successText }}>
        <CircleCheck size={18} /> The program fee has been received. Thank you.
      </div>
    );
  }
  if (!payment || (!payment.url && !payment.note)) return null;
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: 22, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, fontWeight: 600, color: COLORS.ink }}>
        <CreditCard size={19} color={COLORS.ink} /> Next: the program fee
      </div>
      {payment.note && <p style={{ fontSize: 14.5, color: COLORS.text2, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{payment.note}</p>}
      {payment.url && (
        <a href={payment.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: COLORS.ink, color: COLORS.white, fontWeight: 600, fontSize: 15, padding: "12px 20px", textDecoration: "none" }}>
          {payment.label || "Pay the program fee"} <ExternalLink size={15} />
        </a>
      )}
      <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 12 }}>The payment page is outside this site. EIB marks the fee as received once it arrives; that can take a few days.</div>
    </div>
  );
}
