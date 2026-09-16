"use client";

import React from "react";
import { signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { COLORS } from "./ui";

export function GoogleSignInButton({ callbackUrl = "/", label = "Sign in with Google", style }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: COLORS.indigo,
        color: "#fff",
        border: "none",
        borderRadius: 12,
        padding: "13px 18px",
        fontSize: 15,
        fontWeight: 800,
        cursor: "pointer",
        ...style,
      }}
    >
      <LogIn size={16} /> {label}
    </button>
  );
}

export function GoogleSignOutButton({ callbackUrl = "/", label = "Sign out", style }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
        color: COLORS.sub,
        fontWeight: 800,
        fontSize: 13,
        borderRadius: 10,
        padding: "7px 12px",
        cursor: "pointer",
        ...style,
      }}
    >
      <LogOut size={13} /> {label}
    </button>
  );
}
