import LegalPage from "@/components/site/LegalPage";
import { PRIVACY } from "@/lib/legalContent";

export const metadata = { title: "Privacy Policy · EIB", description: PRIVACY.blurb };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} current="/privacy" />;
}
