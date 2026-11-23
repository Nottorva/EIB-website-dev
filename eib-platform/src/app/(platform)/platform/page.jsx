import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Users, ClipboardList, GraduationCap, FileText, Globe, Bot, ClipboardCheck, CheckCheck, Sparkles, Rocket } from "lucide-react";
import { getAccessState, authMode } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { removeLeftoverTestAccount } from "@/lib/data/testAccount";
import { COLORS } from "@/lib/tokens";


// Each person sees only the tools their role can open. Nothing else is listed.
const TOOLS = [
  {
    href: "/editor",
    label: "Lesson Editor",
    icon: Pencil,
    roles: ["superAdmin"],
    blurb: "Author chapters, deliverables, slides links and the mentor flag.",
  },
  {
    href: "/crm",
    label: "Mentor CRM",
    icon: Users,
    roles: ["superAdmin", "studentLeader", "advancement"],
    blurb: "Track mentor outreach and assign one mentor per lesson per cohort.",
  },
  {
    href: "/manager",
    label: "Student Manager",
    icon: ClipboardList,
    roles: ["superAdmin", "studentLeader"],
    blurb: "Review applicants, set up the student agreement, grade deliverables.",
  },
  {
    href: "/grading",
    label: "Grading",
    icon: CheckCheck,
    roles: ["superAdmin", "studentLeader"],
    blurb: "Grade one deliverable across the whole class, student by student.",
  },
  {
    href: "/lessons",
    label: "Lessons",
    icon: GraduationCap,
    roles: ["superAdmin", "studentLeader", "student"],
    blurb: "Each week's session, its materials, and your deliverables.",
  },
  {
    href: "/aida",
    label: "AIDA",
    icon: Sparkles,
    roles: ["superAdmin"],
    blurb: "The students' AI cofounder: every lesson's AI instructions in one place, and a tab to test it.",
  },
  {
    href: "/aida-unlocked",
    label: "AIDA Unlocked",
    icon: Rocket,
    roles: ["superAdmin"],
    blurb: "The demo AI cofounder: the whole EIB method plus live web research, for any founder and any venture.",
  },
  {
    href: "/website",
    label: "Website",
    icon: Globe,
    roles: ["superAdmin"],
    blurb: "The public site: ticker strip and testimonials. Lessons are published from the Lesson Editor.",
  },
  {
    href: "/agent",
    label: "EIB Assistant",
    icon: Bot,
    roles: ["superAdmin"],
    blurb: "The email agent: connections, who may email it, the documents it may edit, and recent threads.",
  },
  {
    href: "/changes",
    label: "Proposed changes",
    icon: ClipboardCheck,
    roles: ["superAdmin"],
    blurb: "Tickets the assistant wrote up from change requests. Approve to apply them to the platform and the documents.",
  },
  {
    href: "/apply",
    label: "Application form",
    icon: FileText,
    roles: ["superAdmin", "studentLeader"],
    tone: "amber",
    blurb: "What applicants see.",
  },
];


export default async function Home() {
  const { user, identity } = await getAccessState();
  // Signed in without a working account: an applicant or a suspended
  // student. They get their status page, never this menu.
  if (!user && identity) redirect("/apply");
  // Students have one page; skip the menu.
  if (user?.role === "student") redirect("/lessons");
  // The advancement team has one tool too.
  if (user?.role === "advancement") redirect("/crm");
  // The advancement team has one tool too.
  if (user?.role === "advancement") redirect("/crm");
  // One-time clean-up of the retired test student account (see testAccount.js).
  if (user?.role === "superAdmin") await removeLeftoverTestAccount().catch((e) => console.error("[eib] test account clean-up failed", e));
  const signInMissing =!user && authMode !== "google" && process.env.NODE_ENV === "production";
  const allowed = TOOLS.filter((t) => user && t.roles.includes(user.role));

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="eib-h1">EIB Platform</h1>
        <div style={{ fontSize: 15, color: COLORS.text2, marginTop: 8, lineHeight: 1.6 }}>
          {user ? (
            <>
              Signed in as <strong style={{ color: COLORS.ink }}>{user.name}</strong> · {ROLE_LABEL[user.role]}
            </>
          ) : signInMissing ? (
            "Sign-in hasn't been set up on this site yet. Please check back later."
          ) : (
            "Sign in with your Google account to continue."
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {allowed.map((t) => {
          const Icon = t.icon;
          const amber = t.tone === "amber";
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                display: "block",
                background: amber ? COLORS.warnBg : COLORS.surface,
                border: `1px solid ${amber ? COLORS.warnBorder : COLORS.border}`,
                padding: 22,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  background: amber ? COLORS.surface : COLORS.bg,
                  color: amber ? COLORS.warnText : COLORS.ink,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Icon size={20} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 14, color: COLORS.text2, lineHeight: 1.55 }}>{t.blurb}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
