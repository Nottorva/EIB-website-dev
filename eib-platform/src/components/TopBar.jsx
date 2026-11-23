"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOKENS, initialsOf } from "./ui";
import { GoogleSignInButton, GoogleSignOutButton } from "./GoogleButtons";

import { ROLE_LABEL } from "@/lib/roles";

const NAV = [
  { href: "/editor", label: "Lesson Editor", roles: ["superAdmin"] },
  { href: "/crm", label: "Mentor CRM", roles: ["superAdmin", "studentLeader", "advancement"] },
  { href: "/manager", label: "Student Manager", roles: ["superAdmin", "studentLeader"] },
  { href: "/grading", label: "Grading", roles: ["superAdmin", "studentLeader"] },
  // The super admin's bar leaves out Lessons, Website and Changes. Those pages
  // still open from the home menu (/platform).
  { href: "/lessons", label: "Lessons", roles: ["studentLeader", "student"] },
  { href: "/aida", label: "AIDA", roles: ["superAdmin"] },
  { href: "/aida-unlocked", label: "AIDA Unlocked", roles: ["superAdmin"] },
  { href: "/agent", label: "Assistant", roles: ["superAdmin"] },
];

function Identity({ user, identity, authMode, pathname }) {
  const shown = identity || user;
  if (!shown) {
    if (authMode !== "google" || pathname === "/apply" || pathname === "/signin") return null;
    return <GoogleSignInButton callbackUrl={pathname || "/platform"} label="Sign in" style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        aria-hidden="true"
        style={{ width: 36, height: 36, background: TOKENS.bg, border: `1px solid ${TOKENS.border2}`, color: TOKENS.ink, fontWeight: 600, fontSize: 13, letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {initialsOf(shown.name)}
      </div>
      <div style={{ textAlign: "left", lineHeight: 1.3 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>{shown.name}</div>
        {user && <div style={{ fontSize: 13, color: TOKENS.muted }}>{ROLE_LABEL[user.role]}</div>}
      </div>
      {authMode === "google" && <GoogleSignOutButton callbackUrl={pathname === "/apply" ? "/apply" : "/"} />}
    </div>
  );
}

export default function TopBar({ user, authMode, identity }) {
  const pathname = usePathname();
  // Students and the advancement team have exactly one place to be, so they
  // get no menu: the advancement team's only link is back to the website.
  const single = !user || user.role === "student" || user.role === "advancement";
  const visibleNav = single ? [] : NAV.filter((n) => n.roles.includes(user.role));
  const home = user?.role === "student" ? "/lessons" : user?.role === "advancement" ? "/" : "/platform";

  return (
    <header className="eib-topbar">
      <Link href={home} style={{ display: "flex", alignItems: "baseline", gap: 12, textDecoration: "none" }}>
        <span className="eib-wordmark">EIB</span>
        <span style={{ fontSize: 13, color: TOKENS.muted }}>joineib.ca</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "10px 28px", flexWrap: "wrap" }}>
        <nav aria-label="Tools" style={{ display: "flex", gap: "4px 22px", flexWrap: "wrap" }}>
          {visibleNav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className="eib-navlink"
                aria-current={active ? "page" : undefined}
                // Clicking a tool in the bar always lands on that tool's home
                // view, even when it is already open (a Link to the same URL
                // does not remount), so tools listen for this and reset.
                onClick={() => window.dispatchEvent(new CustomEvent("eib:tool-home", { detail: n.href }))}
              >
                {n.label}
              </Link>
            );
          })}
          {user && user.role === "advancement" && (
            <Link href="/" className="eib-navlink">
              Back to the website
            </Link>
          )}
        </nav>

        <Identity user={user} identity={identity} authMode={authMode} pathname={pathname} />
      </div>
    </header>
  );
}
