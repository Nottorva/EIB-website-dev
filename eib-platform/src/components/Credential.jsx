"use client";

// The EIB Founder Micro-Credential as people see it:
//   Credential       the public page at /c/<id> (no sign-in)
//   CredentialCard   the student's own card at the top of their Lessons page
//   LinkedInButton   "Add to LinkedIn", on both
// The credential itself is built in lib/data/credentials.js.

import { useState } from "react";
import { BadgeCheck, Ban, Award, Copy, Check, ExternalLink, Linkedin } from "lucide-react";
import { COLORS } from "./ui";
import { PayloadView } from "./DeliverableInputs";
import { fmtLongDateYear } from "@/lib/format";

const LINKEDIN_BLUE = "#0a66c2";

export function LinkedInButton({ href, style }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: LINKEDIN_BLUE, color: "#fff", fontWeight: 800, fontSize: 14.5, borderRadius: 999, padding: "11px 18px", textDecoration: "none", ...style }}>
      <Linkedin size={16} /> Add to LinkedIn
    </a>
  );
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <button type="button" onClick={copy} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "10px 16px", cursor: "pointer" }}>
      {copied ? <Check size={15} color={COLORS.green} /> : <Copy size={15} />} {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

/* ---------- the student's card on their Lessons page ---------- */
export function CredentialCard({ credential }) {
  if (!credential) return null;
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.greenBorder}`, borderRadius: 18, padding: 22, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, fontWeight: 900, color: COLORS.text }}>
        <Award size={20} color={COLORS.green} /> Your micro-credential
      </div>
      <p style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.6, margin: "8px 0 0" }}>
        You have earned the <strong style={{ color: COLORS.text }}>{credential.title}</strong>, issued {fmtLongDateYear(credential.issuedAt)}. It has its own page that anyone with the link can open, and you can add it to your LinkedIn profile.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <a href={credential.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 14.5, borderRadius: 999, padding: "11px 18px", textDecoration: "none" }}>
          View my credential <ExternalLink size={15} />
        </a>
        <LinkedInButton href={credential.linkedIn} />
        <CopyLink url={credential.url} />
      </div>
    </div>
  );
}

/* ---------- the public page ---------- */
const page = { minHeight: "100dvh", background: COLORS.bg, padding: "32px 16px calc(56px + env(safe-area-inset-bottom))" };
const column = { maxWidth: 760, margin: "0 auto" };
const sheet = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 22, padding: "30px 28px", boxShadow: "0 10px 40px rgba(15,23,42,0.06)" };
const eyebrow = { fontSize: 12, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.5 };
const anchorOf = (d) => `d-${String(d.short).replace(/[^A-Za-z0-9]/g, "")}`;

function Fact({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginTop: 4, overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
}

function Work({ d, id }) {
  return (
    <div id={id} style={{ scrollMarginTop: 16 }}>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>
        <span style={{ color: COLORS.indigo }}>{d.short}</span> · {d.title}
      </div>
      <PayloadView type={d.type} payload={d.payload} />
    </div>
  );
}

export default function Credential({ credential: c, url, linkedIn }) {
  const revoked = c.status !== "active";
  const lessons = [];
  for (const d of c.deliverables || []) {
    const last = lessons[lessons.length - 1];
    if (last && last.number === d.lessonNumber) last.items.push(d);
    else lessons.push({ number: d.lessonNumber, title: d.lessonTitle, items: [d] });
  }

  return (
    <div style={page}>
      <div style={column}>
        <div style={{ ...sheet, borderColor: revoked ? COLORS.redBorder : COLORS.border }}>
          {revoked ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.redSoft, border: `1px solid ${COLORS.redBorder}`, color: COLORS.red, fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "7px 14px" }}>
              <Ban size={16} /> Revoked
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLORS.greenSoft, border: `1px solid ${COLORS.greenBorder}`, color: COLORS.green, fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "7px 14px" }}>
              <BadgeCheck size={17} /> Verified
            </div>
          )}

          <h1 style={{ fontSize: 30, fontWeight: 900, color: COLORS.text, lineHeight: 1.2, margin: "18px 0 0" }}>{c.title}</h1>
          <div style={{ fontSize: 15, color: COLORS.sub, marginTop: 14 }}>{revoked ? "Was awarded to" : "Awarded to"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, marginTop: 2, textDecoration: revoked ? "line-through" : "none" }}>{c.studentName}</div>

          {revoked && (
            <p style={{ fontSize: 15, color: COLORS.red, fontWeight: 700, lineHeight: 1.6, margin: "18px 0 0" }}>
              This credential has been revoked by {c.issuer}
              {c.revokedAt ? ` on ${fmtLongDateYear(c.revokedAt)}` : ""} and is no longer valid.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 18, marginTop: 24, paddingTop: 22, borderTop: `1px solid ${COLORS.border}` }}>
            <Fact label="Issued by">{c.issuer}</Fact>
            <Fact label="Cohort">{c.cohort}</Fact>
            <Fact label="Issue date">{fmtLongDateYear(c.issuedAt)}</Fact>
            <Fact label="Credential ID">
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13.5 }}>{c.id}</span>
            </Fact>
          </div>

          {!revoked && (
            <>
              <div style={{ marginTop: 24 }}>
                <div style={eyebrow}>Criteria</div>
                <p style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.65, margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{c.criteria}</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                <LinkedInButton href={linkedIn} />
                <CopyLink url={url} />
              </div>
            </>
          )}
        </div>

        {!revoked && c.story && (
          <div style={{ ...sheet, marginTop: 18 }}>
            <div style={eyebrow}>Founder story</div>
            <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, margin: "6px 0 14px" }}>
              {c.studentName.split(" ")[0]}'s founder story
            </div>
            {c.story.type === "text" ? <div style={{ fontSize: 16, color: COLORS.text, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{c.story.payload?.text}</div> : <PayloadView type={c.story.type} payload={c.story.payload} />}
          </div>
        )}

        {!revoked && lessons.length > 0 && (
          <div style={{ ...sheet, marginTop: 18 }}>
            <div style={eyebrow}>Deliverables</div>
            <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, margin: "6px 0 12px" }}>The work behind this credential</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              {c.deliverables.map((d) => (
                <a key={anchorOf(d)} href={`#${anchorOf(d)}`} style={{ fontSize: 13, fontWeight: 700, color: COLORS.indigo, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 999, padding: "5px 11px", textDecoration: "none" }}>
                  {d.short} · {d.title}
                </a>
              ))}
            </div>
            {lessons.map((l) => (
              <div key={l.number} style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 14 }}>
                  Lesson {l.number} · {l.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {l.items.map((d) => (
                    <Work key={anchorOf(d)} d={d} id={anchorOf(d)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 12.5, color: COLORS.faint, marginTop: 22, lineHeight: 1.6 }}>
          {revoked ? "This page is the record of a revoked credential." : "This page is the official record of this credential."} Issued by {c.issuer} · <a href="https://www.joineib.ca" style={{ color: COLORS.faint }}>joineib.ca</a>
        </div>
      </div>
    </div>
  );
}
