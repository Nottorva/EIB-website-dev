// Where a parent or guardian lands from their emailed sign-up link. Public:
// the link is the key. The first time it is opened it takes the seat (or the
// waitlist spot) for their child; after that it shows where things stand,
// lets them sign the Student Agreement on their own, and says how to pay.
import { headers } from "next/headers";
import ParentSignup from "@/components/ParentSignup";
import { openParentLink } from "@/lib/data/parentSignup";
import { getStudentAgreement, isSigned } from "@/lib/data/agreement";
import { getWaitlistSpots } from "@/lib/data/settings";
import { getUser } from "@/lib/data/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "EIB · Sign-up for parents" };

export default async function ParentPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const h = await headers();
  const host = h.get("host") || "www.joineib.ca";
  const origin = `${h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")}://${host}`;

  const link = await openParentLink(token, { origin });
  const base = { state: link.state, token, studentName: link.signup?.studentName || "", parentName: link.signup?.parentName || "" };
  if (link.state === "waitlist") return <ParentSignup {...base} position={link.position} waitlistSpots={await getWaitlistSpots()} />;
  if (link.state !== "seat") return <ParentSignup {...base} />;

  const [meta, student] = await Promise.all([getStudentAgreement(), getUser(link.application.studentId)]);
  const signed = isSigned(student?.agreement, meta);
  return (
    <ParentSignup
      {...base}
      signed={signed}
      // nothing to sign when no agreement is uploaded or signing is switched off
      toSign={Boolean(meta.required && meta.pdf && !signed)}
      agreement={{ title: meta.title, intro: meta.intro, wording: meta.wording, relationships: meta.relationships, questions: meta.questions }}
      payment={meta.payment}
      paid={Boolean(link.application.paidAt)}
    />
  );
}
