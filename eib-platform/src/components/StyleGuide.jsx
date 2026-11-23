"use client";

// A preview of the design system's shared components (DESIGN.md), on one
// page. Nothing here saves anything: the buttons only change this page.
import { useState } from "react";
import { Plus, Trash2, Download, Pencil, List, LayoutGrid } from "lucide-react";
import {
  TOKENS,
  PageShell,
  Section,
  FeatureCard,
  TwoColumn,
  KeyValue,
  Eyebrow,
  H1,
  H2,
  TextLink,
  FieldLabel,
  fieldStyle,
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
  HeaderButton,
  IconButton,
  SegmentedTabs,
  StatusBadge,
  FilterBar,
  Avatar,
  Card,
  Notice,
  SaveIndicator,
  Loading,
  EmptyState,
  ModalShell,
  TypeChip,
  useDangerConfirm,
} from "./ui";

const SWATCHES = [
  ["bg", "Page background"],
  ["surface", "Cards, sections, inputs"],
  ["ink", "Text, primary button"],
  ["inkHover", "Hover"],
  ["text2", "Body text in cards"],
  ["muted", "Labels, captions"],
  ["border", "Card borders"],
  ["border2", "Input borders"],
  ["accent", "Brass: rules and frames only"],
];

const STATUSES = [
  { id: "active", label: "Active", color: TOKENS.successText, soft: TOKENS.successBg, border: TOKENS.successBorder },
  { id: "waiting", label: "Waiting", color: TOKENS.warnText, soft: TOKENS.warnBg, border: TOKENS.warnBorder },
  { id: "declined", label: "Declined", color: TOKENS.errorText, soft: TOKENS.errorBg, border: TOKENS.errorBorder },
];

const ROWS = [
  { name: "Amara Okafor", status: STATUSES[0], lessons: 12, score: "94%" },
  { name: "Daniel Lee", status: STATUSES[1], lessons: 9, score: "81%" },
  { name: "Sofia Marin", status: STATUSES[2], lessons: 3, score: "40%" },
];

export default function StyleGuide() {
  const [tab, setTab] = useState("list");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [result, setResult] = useState("");
  const [confirmDanger, confirmUI] = useDangerConfirm();

  const rows = ROWS.filter((r) => (filter === "all" || r.status.id === filter) && r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell>
      <div>
        <Eyebrow>Design system</Eyebrow>
        <H1>The shared components</H1>
        <p className="eib-prose" style={{ color: TOKENS.text2, margin: "16px 0 0" }}>
          Every page of the platform is built from the pieces on this page. Square corners, no shadows, serif for display only, brass for decoration only. Nothing here saves anything, so click freely.
        </p>
      </div>

      <FeatureCard eyebrow="Feature card" title="One per page, for the thing that matters most">
        <div className="eib-name" style={{ marginBottom: 12 }}>
          Amara Okafor
        </div>
        <p className="eib-prose" style={{ color: TOKENS.text2, margin: "0 0 24px" }}>
          A feature card is an ordinary card with a thin brass frame set inside its edge and a short brass rule under the heading. The italic line above is the name / feature line.
        </p>
        <KeyValue
          items={[
            { label: "Cohort", value: "2026 to 2027" },
            { label: "Venture", value: "Northside Tutoring Co." },
            { label: "Mentor", value: "Priya Raman" },
            { label: "Lessons complete", value: "12 of 14" },
          ]}
        />
      </FeatureCard>

      <Section eyebrow="Type" title="Type scale">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="eib-wordmark">EIB</div>
          <div className="eib-h1">Heading one, Cormorant 52</div>
          <div className="eib-h2">Heading two, Cormorant 32</div>
          <div className="eib-name">Name or feature line, italic 38</div>
          <div className="eib-eyebrow">Eyebrow label</div>
          <div className="eib-label">Field label</div>
          <div className="eib-prose">Body text is Inter at 16px with a 1.6 line height, held to one column of about 60 to 75 characters so it stays comfortable to read.</div>
          <div className="eib-caption">Small caption text in muted, 13 to 14px.</div>
          <div>
            <div style={{ fontWeight: 600 }}>Item title</div>
            <div style={{ fontSize: 15, color: TOKENS.text2 }}>Followed by a 15px description in the second text colour.</div>
          </div>
          <div>
            <TextLink href="#top">A text link, underlined in ink</TextLink>
          </div>
        </div>
      </Section>

      <Section eyebrow="Colour" title="Tokens">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
          {SWATCHES.map(([key, note]) => (
            <div key={key}>
              <div style={{ height: 56, background: TOKENS[key], border: `1px solid ${TOKENS.border2}` }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{key}</div>
              <div className="eib-caption">
                {TOKENS[key]} · {note}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Actions" title="Buttons">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <PrimaryButton onClick={() => setClicks((c) => c + 1)}>Primary button</PrimaryButton>
          <SecondaryButton onClick={() => setClicks((c) => c + 1)}>Secondary</SecondaryButton>
          <TertiaryButton onClick={() => setClicks((c) => c + 1)}>Tertiary</TertiaryButton>
          <PrimaryButton icon={Plus} onClick={() => setClicks((c) => c + 1)}>
            With an icon
          </PrimaryButton>
          <PrimaryButton disabled>Disabled</PrimaryButton>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
          <PrimaryButton size="sm" onClick={() => setClicks((c) => c + 1)}>
            Small primary
          </PrimaryButton>
          <SecondaryButton size="sm" icon={Download} onClick={() => setClicks((c) => c + 1)}>
            Small secondary
          </SecondaryButton>
          <HeaderButton tone="danger" icon={Trash2} label="Delete" onClick={async () => setResult((await confirmDanger({ title: "Delete this example?", body: "This is only a demonstration. Nothing is deleted." })) ? "You confirmed." : "You cancelled.")} />
          <IconButton icon={Pencil} title="Edit" onClick={() => setClicks((c) => c + 1)} />
          <SaveIndicator status="saved" />
          <SaveIndicator status="saving" />
        </div>
        <p className="eib-caption" data-testid="clicks" style={{ margin: "14px 0 0" }}>
          Buttons clicked: {clicks}. {result}
        </p>
      </Section>

      <Section eyebrow="Forms" title="Inputs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          <label>
            <FieldLabel>Full name</FieldLabel>
            <input style={fieldStyle} placeholder="Click to see the focus ring" />
          </label>
          <label>
            <FieldLabel>Relationship</FieldLabel>
            <select style={fieldStyle} defaultValue="parent">
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
            </select>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            <FieldLabel>Notes</FieldLabel>
            <textarea style={{ ...fieldStyle, minHeight: 96, resize: "vertical" }} placeholder="A longer answer" />
          </label>
        </div>
      </Section>

      <Section eyebrow="Messages" title="Status banners">
        <Notice tone="success" lead="Agreement signed.">
          A copy has been emailed to you and your parent or guardian.
        </Notice>
        <Notice tone="neutral" lead="Class starts in September.">
          Lessons open when the class is started.
        </Notice>
        <Notice tone="amber" lead="One step left.">
          Your parent or guardian has not signed yet.
        </Notice>
        <Notice tone="error" lead="That did not save." style={{ marginBottom: 0 }}>
          Check your connection and try again.
        </Notice>
      </Section>

      <Section eyebrow="Data" title="Tabs, filters and tables">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { id: "list", label: "Table", icon: List },
            { id: "cards", label: "Cards", icon: LayoutGrid },
          ]}
          style={{ maxWidth: 320, marginBottom: 20 }}
        />
        <FilterBar filter={filter} setFilter={setFilter} statuses={STATUSES} search={search} setSearch={setSearch} placeholder="Search students" />
        {rows.length === 0 ? (
          <EmptyState>No students match.</EmptyState>
        ) : tab === "list" ? (
          <table className="eib-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th className="num">Lessons</th>
                <th className="num">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ color: TOKENS.ink, fontWeight: 500 }}>{r.name}</td>
                  <td>
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="num">{r.lessons}</td>
                  <td className="num">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => (
              <Card key={r.name} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar name={r.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 15, color: TOKENS.text2 }}>{r.lessons} lessons complete</div>
                </div>
                <StatusBadge status={r.status} />
              </Card>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
          <TypeChip type="text" points={10} />
          <TypeChip type="table" />
          <TypeChip type="checklist" uppercase />
        </div>
      </Section>

      <TwoColumn
        main={
          <Section eyebrow="Layout" title="Two columns">
            <p className="eib-prose" style={{ color: TOKENS.text2, margin: 0 }}>
              The main column takes the room; the side column sits beside it on a wide screen and drops underneath on a phone.
            </p>
          </Section>
        }
        side={
          <Section eyebrow="Side" style={{ padding: 24 }}>
            <SecondaryButton onClick={() => setModal(true)} style={{ width: "100%" }}>
              Open a dialog
            </SecondaryButton>
            <Loading label="Loading example…" />
          </Section>
        }
      />

      {modal && (
        <ModalShell eyebrow="Dialog" title="A dialog box" onClose={() => setModal(false)} maxWidth={560}>
          <p style={{ color: TOKENS.text2, margin: "0 0 24px" }}>No shadow and no rounded corners: a surface with an ink border over a dimmed page. Close it with the X, the button below, or by clicking outside.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <TertiaryButton onClick={() => setModal(false)}>Cancel</TertiaryButton>
            <PrimaryButton onClick={() => setModal(false)}>Done</PrimaryButton>
          </div>
        </ModalShell>
      )}
      {confirmUI}
    </PageShell>
  );
}
