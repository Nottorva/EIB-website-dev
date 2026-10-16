// The EIB Night deck, viewable in the browser. Public: no sign-in, nothing
// read from the database. The PDF itself lives in /public/site.
import Link from "next/link";
import SlideDeck from "@/components/site/SlideDeck";

const DECK = {
  title: "EIB Night 2027",
  file: "/site/eib-night-2027.pdf",
  blurb: "The deck from EIB Night on October 16, 2026: the program, the sessions, the dates and how to apply.",
};

export const metadata = {
  title: `${DECK.title} · EIB slides`,
  description: DECK.blurb,
};

export default function SlidesPage() {
  return (
    <div className="site slidespage">
      <header className="chrome">
        <nav className="nav glass" aria-label="Primary">
          <i className="sheen" aria-hidden="true" />
          <Link className="brand" href="/">
            <span className="mark">EIB</span>
          </Link>
          <a className="apply" href={DECK.file} download="EIB Night 2027.pdf">
            Download<span className="apply-x"> the PDF</span>
          </a>
          <Link className="signin" href="/apply">
            Apply
          </Link>
        </nav>
      </header>

      <main className="slidesmain">
        <div className="slideshead">
          <p className="mono eyebrow">Slides</p>
          <h1 className="d h2">{DECK.title}</h1>
          <p className="lede">{DECK.blurb}</p>
        </div>
        <SlideDeck src={DECK.file} title={DECK.title} />
        <p className="deckfoot">
          <Link href="/">Back to the site</Link>
          <span aria-hidden="true"> · </span>
          <a href={DECK.file} download="EIB Night 2027.pdf">Download the PDF</a>
        </p>
      </main>
    </div>
  );
}
