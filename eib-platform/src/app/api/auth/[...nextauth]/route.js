// Google sign-in endpoints (NextAuth). Returns 404 until AUTH_GOOGLE_* is set.
import { handlers } from "@/lib/nextauth";

export const { GET, POST } = handlers;
