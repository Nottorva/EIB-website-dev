// The public site at "/". A server component: it reads the database
// directly and hands the client components only what the page shows.
// Nothing student-facing (links, deliverables, rooms) ever reaches this page.
import Link from "next/link";
import { getCurrentUser, getSessionIdentity, authMode } from "@/lib/auth";
import { getSiteTicker, getApplicationWindow, windowState, getCohortYear } from "@/lib/data/settings";
import { REEL, DIFFERENCE, CARD_QUOTES, CURRICULUM, COST, FOOTER, groupLessons } from "@/lib/siteContent";
import SiteChrome from "@/components/site/SiteChrome";
import Reel from "@/components/site/Reel";
import Curriculum from "@/components/site/Curriculum";
import CardReveal from "@/components/site/CardReveal";
import QuoteCarousel from "@/components/site/QuoteCarousel";

export const metadata = {
  title: "EIB · Entrepreneurship, Innovation & Business",
  description: "A venture track inside the school timetable, built around agency, judgment, consequence and community.",
};

// "2026–27" from the cohort year setting.
const cohortLabel = (year) => `${year}–${String(year + 1).slice(-2)}`;

function applicationLine(win, year) {
  const fmt = (iso) => new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", timeZone: "America/Toronto" });
  const state = windowState(win);
  if (state === "upcoming") return `Applications open ${fmt(win.opensAt)}`;
  if (state === "closed") return "Applications for this cohort have closed";
  return `Applications open for the ${cohortLabel(year)} cohort`;
}

export default async function SitePage() {
  const [user, identity, ticker, win, year] = await Promise.all([
    getCurrentUser(),
    authMode === "google" ? getSessionIdentity() : null,
    getSiteTicker(),
    getApplicationWindow(),
    getCohortYear(),
  ]);

  const stages = groupLessons(CURRICULUM);

  return (
    <div className="site">
      <SiteChrome
        ticker={[applicationLine(win, Number(year)), ...ticker]}
        user={user ? { name: user.name, role: user.role } : null}
        identity={identity ? { name: identity.name } : null}
        authMode={authMode}
      />

      <Reel reel={REEL} />

      <main className="after" id="after">
        <section className="sec card" id="spec" data-chrome="light">
          <CardReveal photo="/site/card-bg.jpg" />
          <div className="wrap">
            <p className="mono eyebrow">{DIFFERENCE.eyebrow}</p>
            <h2 className="d h2">{DIFFERENCE.headline}</h2>
            <p className="lede">{DIFFERENCE.lede}</p>

            <blockquote className="mission">
              <p>{DIFFERENCE.mission}</p>
            </blockquote>

            <QuoteCarousel quotes={CARD_QUOTES} />
          </div>
        </section>

        <Curriculum stages={stages} />

        <section className="sec paper cost" id="cost" data-chrome="light">
          <div className="wrap">
            <p className="mono eyebrow">{COST.eyebrow}</p>
            <h2 className="d h2">{COST.headline}</h2>
            <p className="lede">{COST.body}</p>
            <Link className="apply" href="/apply">
              Apply now
            </Link>
          </div>
        </section>
      </main>

      <footer className="foot" data-chrome="light">
        <div className="wrap footrow">
          <div className="footbrand">
            <span className="mark">EIB</span>
            <p className="mono">{FOOTER.tagline}</p>
            <ul className="footlinks mono">
              <li>
                <Link href="/apply">Apply</Link>
              </li>
              <li>
                <Link href="/platform">Platform sign-in</Link>
              </li>
            </ul>
          </div>
          <dl className="footmeta">
            {FOOTER.meta.map(([dt, dd]) => (
              <div key={dt}>
                <dt className="mono">{dt}</dt>
                <dd>{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </footer>
    </div>
  );
}
