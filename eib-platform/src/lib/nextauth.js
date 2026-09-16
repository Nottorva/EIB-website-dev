// Google sign-in via NextAuth (Auth.js v5).
//
// Enabled when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set (plus AUTH_SECRET).
// Sessions are stateless JWTs, so no database adapter is needed. Google is
// only used to prove who someone is; what they may do is decided afterwards:
//   - staff and students: their email must be in the `users` allow-list
//   - applicants: their email must be on the configured school domain
// Both checks live in auth.js / applicant.js, not here.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const authEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

function build() {
  if (!authEnabled) {
    const notConfigured = async () => new Response("Google sign-in is not configured.", { status: 404 });
    return {
      handlers: { GET: notConfigured, POST: notConfigured },
      auth: async () => null,
      signIn: async () => {},
      signOut: async () => {},
    };
  }
  return NextAuth({
    providers: [
      Google({
        authorization: { params: { prompt: "select_account" } },
      }),
    ],
    session: { strategy: "jwt" },
    trustHost: true,
    pages: { signIn: "/signin" },
    callbacks: {
      async jwt({ token, profile }) {
        if (profile?.email) {
          token.email = String(profile.email).toLowerCase();
          token.name = profile.name || token.name;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.email = token.email;
          session.user.name = token.name;
        }
        return session;
      },
    },
  });
}

export const { handlers, auth, signIn, signOut } = build();
