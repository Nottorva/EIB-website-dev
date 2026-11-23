// The public page of an EIB Founder Micro-Credential (see lib/data/credentials.js).
// No sign-in and no platform menu: the unguessable link is the key. Search
// engines are told to stay out, here and in next.config.mjs. A link that was
// never issued gets the same "not found" page whatever it says.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Credential from "@/components/Credential";
import { getPublicCredential, linkedInUrl, credentialUrl } from "@/lib/data/credentials";

export const dynamic = "force-dynamic";
const robots = { index: false, follow: false };

export async function generateMetadata({ params }) {
  const credential = await getPublicCredential((await params).id);
  if (!credential) return { title: "Credential not found · EIB", robots };
  return { title: `${credential.studentName} · ${credential.title}`, description: `${credential.title}, issued by ${credential.issuer}.`, robots };
}

export default async function CredentialPage({ params }) {
  const credential = await getPublicCredential((await params).id);
  if (!credential) notFound();
  const h = await headers();
  const host = h.get("host") || "www.joineib.ca";
  const origin = `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const active = credential.status === "active";
  return <Credential credential={credential} url={credentialUrl(credential, origin)} linkedIn={active ? linkedInUrl(credential, origin) : ""} />;
}
