// The public site at "/". A server component: it reads the database
// directly and hands the client components only what the page shows.
// Nothing student-facing (links, deliverables, rooms) ever reaches this page.
import Link from "next/link";
import { getCurrentUser, getSessionIdentity, authMode } from "@/lib/auth";
import { listPublishedLessons } from "@/lib/data/lessons";
import { listApprovedTestimonials, toPublicTestimonial } from "@/lib/data/testimonials";
import { getSiteTicker, getApplicationWindow, windowState } from "@/lib/data/settings";
import { REEL, DIFFERENCE, PLACEHOLDER_TESTIMONIALS, FALLBACK_LESSONS, FOOTER, groupLessons } from "@/lib/siteContent";
import SiteChrome from "@/components/site/SiteChrome";
import Reel from "@/components/site/Reel";
import Voices from "@/components/site/Voices";
import Curriculum from "@/components/site/Curriculum";

export const metadata = {
  title: "EIB · Build the company before university",
  description: REEL.hero.body,
};

function applicationLine(win) {
  const fmt = (iso) => new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", timeZone: "America/Toronto" });
  const state = windowState(win);
  if (state === "upcoming") return `Applications open ${fmt(win.opensAt)}`;
  if (state === "closed") return "Applications for this cohort have closed";
  return win.closesAt ? `Applications open until ${fmt(win.closesAt)}` : "Applications open for the next cohort";
}

export default async function SitePage() {
  const [user, identity, ticker, win, published, approved] = await Promise.all([
    getCurrentUser(),
    authMode === "google" ? getSessionIdentity() : null,
    getSiteTicker(),
    getApplicationWindow(),
    listPublishedLessons(),
    listApprovedTestimonials(),
  ]);

  const lessons = published.length ? published : FALLBACK_LESSONS;
  const stages = groupLessons(lessons);
  const testimonials = approved.length ? approved.map(toPublicTestimonial) : PLACEHOLDER_TESTIMONIALS;

  return (
    <div className="site">
      <SiteChrome
        ticker={[applicationLine(win), ...ticker]}
        user={user ? { name: user.name, role: user.role } : null}
        identity={identity ? { name: identity.name } : null}
        authMode={authMode}
      />

      <Reel reel={REEL} />

      <main className="after" id="after">
        <section className="sec card" id="spec" data-chrome="light">
          <div className="wrap">
            <p className="mono eyebrow">{DIFFERENCE.eyebrow}</p>
            <h2 className="d h2">{DIFFERENCE.headline}</h2>
            <p className="lede">{DIFFERENCE.lede}</p>

            <blockquote className="mission">
              <p>{DIFFERENCE.mission}</p>
            </blockquote>

            <div className="contrast">
              <div className="crow chead">
                <p className="mono">Most programmes</p>
                <p className="mono cyes">EIB</p>
              </div>
              {DIFFERENCE.rows.map(([no, yes]) => (
                <div className="crow" key={yes}>
                  <p className="cno">{no}</p>
                  <p className="cval">{yes}</p>
                </div>
              ))}
            </div>

            <p className="mono facts">{DIFFERENCE.facts}</p>
          </div>
        </section>

        <Voices testimonials={testimonials} placeholder={!approved.length} />

        <Curriculum stages={stages} lessonCount={lessons.length} />
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
