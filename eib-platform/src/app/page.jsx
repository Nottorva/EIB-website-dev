import Link from "next/link";
import { Pencil, Users, ClipboardList, GraduationCap, FileText, ShieldAlert } from "lucide-react";
import { getCurrentUser, authMode } from "@/lib/auth";

const COLORS = {
  text: "#0f1222",
  sub: "#64748b",
  faint: "#94a3b8",
  border: "#eef1f6",
  indigo: "#4f46e5",
  indigoSoft: "#eef0ff",
  amber: "#b45309",
  amberSoft: "#fdf3e0",
  amberBorder: "#f3dfb0",
};

const TOOLS = [
  {
    href: "/editor",
    label: "Lesson Editor",
    icon: Pencil,
    roles: ["superAdmin"],
    blurb: "Author chapters, deliverables, slides links and the mentor flag. Super admin only.",
  },
  {
    href: "/crm",
    label: "Mentor CRM",
    icon: Users,
    roles: ["superAdmin", "studentLeader"],
    blurb: "Track mentor outreach, keep private contacts private, assign one mentor per lesson per cohort.",
  },
  {
    href: "/manager",
    label: "Student Manager",
    icon: ClipboardList,
    roles: ["superAdmin", "studentLeader"],
    blurb: "Edit the application form, move applicants through the pipeline, grade deliverables.",
  },
  {
    href: "/lessons",
    label: "Lessons",
    icon: GraduationCap,
    roles: ["superAdmin", "studentLeader", "student"],
    blurb: "The textbook view. Students submit work and see grades; leaders see instructions and examples.",
  },
];

const ROLE_LABEL = { superAdmin: "Super admin", studentLeader: "Student leader", student: "Student" };

export default async function Home() {
  const user = await getCurrentUser();
  const signInMissing = !user && authMode !== "google" && process.env.NODE_ENV === "production";
  const allowed = TOOLS.filter((t) => user && t.roles.includes(user.role));
  const blocked = TOOLS.filter((t) => !user || !t.roles.includes(user.role));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 80px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Local sandbox
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.text }}>EIB Platform</div>
        <div style={{ fontSize: 15, color: COLORS.sub, marginTop: 8, lineHeight: 1.6 }}>
          {user ? (
            <>
              Signed in as <strong style={{ color: COLORS.text }}>{user.name}</strong> ({ROLE_LABEL[user.role]}). What you can open depends on
              that role, and every API route checks it again server-side.
            </>
          ) : (
            <>
              {signInMissing
                ? "Sign-in hasn't been configured on this site yet. An EIB admin needs to set up Google sign-in before anyone can use it."
                : "This account is not on the EIB allow-list, so no tools are available."}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {allowed.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                display: "block",
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                padding: 22,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: COLORS.indigoSoft,
                  color: COLORS.indigo,
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
        <Link
          href="/apply"
          style={{
            display: "block",
            background: COLORS.amberSoft,
            border: `1px solid ${COLORS.amberBorder}`,
            borderRadius: 18,
            padding: 22,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "#fff",
              color: COLORS.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <FileText size={20} strokeWidth={2.25} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Application form</div>
          <div style={{ fontSize: 14, color: COLORS.sub, lineHeight: 1.55 }}>
            What applicants see. Public, no sign-in. Submissions land in the Student Manager as "Pending".
          </div>
        </Link>
      </div>

      {blocked.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.faint, marginBottom: 10 }}>
            <ShieldAlert size={14} /> Not available for this role
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {blocked.map((t) => (
              <span
                key={t.href}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.faint,
                  background: "#fff",
                  border: `1px dashed ${COLORS.border}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
