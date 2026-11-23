"use client";

import { signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";

export function GoogleSignInButton({ callbackUrl = "/platform", label = "Sign in with Google", style }) {
  return (
    <button type="button" onClick={() => signIn("google", { callbackUrl })} className="eib-btn" style={{ display: "flex", ...style }}>
      <LogIn size={18} strokeWidth={2} /> {label}
    </button>
  );
}

export function GoogleSignOutButton({ callbackUrl = "/", label = "Sign out", style }) {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl })} className="eib-btn eib-btn--tertiary eib-btn--sm" style={{ display: "flex", ...style }}>
      <LogOut size={18} strokeWidth={2} /> {label}
    </button>
  );
}
