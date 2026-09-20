"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Pencil, Users, ClipboardList, GraduationCap, FileText, Globe } from "lucide-react";
import { COLORS } from "./ui";
import { GoogleSignInButton, GoogleSignOutButton } from "./GoogleButtons";

const ROLE_LABEL = { superAdmin: "Super admin", studentLeader: "Student leader", student: "Student" };

const NAV = [
  { href: "/editor", label: "Lesson Editor", icon: Pencil, roles: ["superAdmin"] },
  { href: "/crm", label: "Mentor CRM", icon: Users, roles: ["superAdmin", "studentLeader"] },
  { href: "/manager", label: "Student Manager", icon: ClipboardList, roles: ["superAdmin", "studentLeader"] },
  { href: "/lessons", label: "Lessons", icon: GraduationCap, roles: ["superAdmin", "studentLeader", "student"] },
  { href: "/website", label: "Website", icon: Globe, roles: ["superAdmin"] },
];

function Identity({ user, identity, authMode, pathname }) {
  const shown = identity || user;
  if (!shown) {
    if (authMode !== "google" || pathname === "/apply" || pathname === "/signin") return null;
    return <GoogleSignInButton callbackUrl={pathname || "/platform"} label="Sign in" style={{ padding: "8px 14px", fontSize: 13.5 }} />;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: COLORS.indigoSoft,
          color: COLORS.indigo,
          fontWeight: 800,
          fontSize: 12.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {String(shown.name || "?")
          .split(" ")
          .filter(Boolean)
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: COLORS.text }}>{shown.name}</div>
        {user && <div style={{ fontSize: 11.5, color: COLORS.faint }}>{ROLE_LABEL[user.role]}</div>}
      </div>
      {authMode === "google" && <GoogleSignOutButton callbackUrl={pathname === "/apply" ? "/apply" : "/"} />}
    </div>
  );
}

export default function TopBar({ user, authMode, identity }) {
  const pathname = usePathname();
  const visibleNav = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <header
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 28px", borderBottom: `1px solid ${COLORS.border}`, background: "#fff", position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Link href="/platform" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={18} color="#fff" strokeWidth={2.25} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>EIB</span>
        </Link>

        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {visibleNav.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: active ? COLORS.indigo : COLORS.sub, background: active ? COLORS.indigoSoft : "transparent", borderRadius: 9, padding: "7px 12px", textDecoration: "none" }}
              >
                <Icon size={15} /> {n.label}
              </Link>
            );
          })}
          {user && user.role !== "student" && (
            <Link
              href="/apply"
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: pathname === "/apply" ? COLORS.amber : COLORS.faint, background: pathname === "/apply" ? COLORS.amberSoft : "transparent", borderRadius: 9, padding: "7px 12px", textDecoration: "none" }}
            >
              <FileText size={15} /> Application form
            </Link>
          )}
        </nav>
      </div>

      <Identity user={user} identity={identity} authMode={authMode} pathname={pathname} />
    </header>
  );
}
