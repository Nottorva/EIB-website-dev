import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Users, ClipboardList, GraduationCap, FileText, Globe } from "lucide-react";
import { getAccessState, authMode } from "@/lib/auth";

const COLORS = {
  text: "#0f1222",
  sub: "#64748b",
  border: "#eef1f6",
  indigo: "#4f46e5",
  indigoSoft: "#eef0ff",
  amber: "#b45309",
  amberSoft: "#fdf3e0",
  amberBorder: "#f3dfb0",
};

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
    roles: ["superAdmin", "studentLeader"],
    blurb: "Track mentor outreach and assign one mentor per lesson per cohort.",
  },
  {
    href: "/manager",
    label: "Student Manager",
    icon: ClipboardList,
    roles: ["superAdmin", "studentLeader"],
    blurb: "Edit the application form, review applicants, grade deliverables.",
  },
  {
    href: "/lessons",
    label: "Lessons",
    icon: GraduationCap,
    roles: ["superAdmin", "studentLeader", "student"],
    blurb: "Each week's session, its materials, and your deliverables.",
  },
  {
    href: "/website",
    label: "Website",
    icon: Globe,
    roles: ["superAdmin"],
    blurb: "The public site: ticker strip and testimonials. Lessons are published from the Lesson Editor.",
  },
  {
    href: "/apply",
    label: "Application form",
    icon: FileText,
    roles: ["superAdmin", "studentLeader"],
    tone: "amber",
    blurb: "What applicants see. Copy the link from the Student Manager's Forms tab.",
  },
];

const ROLE_LABEL = { superAdmin: "Super admin", studentLeader: "Student leader", student: "Student" };

export default async function Home() {
  const { user, identity } = await getAccessState();
  // Signed in without a working account: an applicant or a suspended
  // student. They get their status page, never this menu.
  if (!user && identity) redirect("/apply");
  const signInMissing = !user && authMode !== "google" && process.env.NODE_ENV === "production";
  const allowed = TOOLS.filter((t) => user && t.roles.includes(user.role));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.text }}>EIB Platform</div>
        <div style={{ fontSize: 15, color: COLORS.sub, marginTop: 8, lineHeight: 1.6 }}>
          {user ? (
            <>
              Signed in as <strong style={{ color: COLORS.text }}>{user.name}</strong> · {ROLE_LABEL[user.role]}
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
                background: amber ? COLORS.amberSoft : "#fff",
                border: `1px solid ${amber ? COLORS.amberBorder : COLORS.border}`,
                borderRadius: 18,
                padding: 22,
                textDecoration: "none",
                boxShadow: amber ? "none" : "0 1px 3px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: amber ? "#fff" : COLORS.indigoSoft,
                  color: amber ? COLORS.amber : COLORS.indigo,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Icon size={20} strokeWidth={2.25} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: 14, color: COLORS.sub, lineHeight: 1.55 }}>{t.blurb}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
