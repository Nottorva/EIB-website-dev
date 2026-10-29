// A legal page in the public site's style: a small bar, a title, dated,
// then sections of plain paragraphs and lists. Server component.
import Link from "next/link";
import { LEGAL } from "@/lib/legalContent";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export default function LegalPage({ doc, current }) {
  return (
    <div className="site legalpage">
      <a className="skiplink" href="#legal-main">Skip to content</a>
      <header className="chrome">
        <nav className="nav glass" aria-label="Primary">
          <i className="sheen" aria-hidden="true" />
          <Link className="brand" href="/" aria-label="EIB home">
            <span className="mark">EIB</span>
          </Link>
          <Link className="apply" href="/apply">
            Apply
          </Link>
          <Link className="signin" href="/platform">
            Sign in
          </Link>
        </nav>
      </header>
      <main id="legal-main" className="legalmain">
        <p className="mono eyebrow">
          {LEGAL.operator} · {LEGAL.program}
        </p>
        <h1 className="d h2">{doc.title}</h1>
        <p className="lede">{doc.blurb}</p>
        <p className="mono legaldate">Last updated {LEGAL.updated}</p>
        <nav className="legalnav mono" aria-label="Legal pages">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        {doc.sections.map((s) => (
          <section key={s.h} className="legalsec">
            <h2 className="d">{s.h}</h2>
            {(s.p || []).map((t) => (
              <p key={t}>{t}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {(s.p2 || []).map((t) => (
              <p key={t}>{t}</p>
            ))}
          </section>
        ))}
        <p className="deckfoot">
          <Link href="/">Back to the site</Link>
        </p>
      </main>
    </div>
  );
}
