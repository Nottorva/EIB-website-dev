import LegalPage from "@/components/site/LegalPage";
import { COOKIES } from "@/lib/legalContent";

export const metadata = { title: "Cookie Policy · EIB", description: COOKIES.blurb };

export default function CookiesPage() {
  return <LegalPage doc={COOKIES} current="/cookies" />;
}
