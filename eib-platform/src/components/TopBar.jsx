"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Pencil, Users, ClipboardList, GraduationCap, FileText, Eye } from "lucide-react";
import { COLORS } from "./ui";
import { api } from "@/lib/api";

const NO_ACCESS_SENTINEL = "__stranger__";

const ROLE_LABEL = { superAdmin: "Super admin", studentLeader: "Student leader", student: "Student" };

const NAV = [
  { href: "/editor", label: "Lesson Editor", icon: Pencil, roles: ["superAdmin"] },
  { href: "/crm", label: "Mentor CRM", icon: Users, roles: ["superAdmin", "studentLeader"] },
  { href: "/manager", label: "Student Manager", icon: ClipboardList, roles: ["superAdmin", "studentLeader"] },
  { href: "/lessons", label: "Lessons", icon: GraduationCap, roles: ["superAdmin", "studentLeader", "student"] },
];

export default function TopBar({ user, users }) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const current = user ? user.email : NO_ACCESS_SENTINEL;
  const visibleNav = NAV.filter((n) => user && n.roles.includes(user.role));

  const switchTo = async (email) => {
    setSwitching(true);
    try {
      await api.post("/api/dev/switch-user", { email });
      router.push("/");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  };

  const grouped = ["superAdmin", "studentLeader", "student"].map((role) => ({
    role,
    users: users.filter((u) => u.role === role),
  }));

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 28px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: COLORS.indigo,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: active ? COLORS.indigo : COLORS.sub,
                  background: active ? COLORS.indigoSoft : "transparent",
                  borderRadius: 9,
                  padding: "7px 12px",
                  textDecoration: "none",
                }}
              >
                <Icon size={15} /> {n.label}
              </Link>
            );
          })}
          <Link
            href="/apply"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13.5,
              fontWeight: 800,
              color: pathname === "/apply" ? COLORS.amber : COLORS.faint,
              background: pathname === "/apply" ? COLORS.amberSoft : "transparent",
              borderRadius: 9,
              padding: "7px 12px",
              textDecoration: "none",
            }}
          >
            <FileText size={15} /> Application form (public)
          </Link>
        </nav>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: COLORS.amberSoft,
          border: `1px solid ${COLORS.amberBorder}`,
          borderRadius: 12,
          padding: "6px 8px 6px 12px",
        }}
        title="Dev-only role switcher. Replaced by Google sign-in in production."
      >
        <Eye size={14} color={COLORS.amber} />
        <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.amber, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
          VIEWING AS
        </span>
        <select
          value={current}
          disabled={switching}
          onChange={(e) => switchTo(e.target.value)}
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: COLORS.text,
            background: "#fff",
            border: `1px solid ${COLORS.amberBorder}`,
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            maxWidth: 260,
          }}
        >
          {grouped.map((g) => (
            <optgroup key={g.role} label={ROLE_LABEL[g.role]}>
              {g.users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name} ({ROLE_LABEL[g.role]})
                </option>
              ))}
              {g.users.length === 0 && <option disabled>None yet</option>}
            </optgroup>
          ))}
          <optgroup label="Not on the allow-list">
            <option value={NO_ACCESS_SENTINEL}>Stranger (no users row)</option>
          </optgroup>
        </select>
      </div>
    </header>
  );
}
