import LegalPage from "@/components/site/LegalPage";
import { TERMS } from "@/lib/legalContent";

export const metadata = { title: "Terms and Conditions · EIB", description: TERMS.blurb };

export default function TermsPage() {
  return <LegalPage doc={TERMS} current="/terms" />;
}
