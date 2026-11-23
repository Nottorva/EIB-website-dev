import "./globals.css";
import { Archivo, Newsreader, IBM_Plex_Mono, Cormorant_Garamond, Inter } from "next/font/google";

// The public site's three typefaces, self-hosted by next/font so they never
// flash. They are exposed as CSS variables and only the site stylesheet uses
// them; the platform tools keep their system font.
const archivo = Archivo({ subsets: ["latin"], weight: "variable", axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

// The design system's two typefaces (DESIGN.md): Cormorant Garamond for
// display, Inter for everything else. Inter stops at 600 on purpose, so no
// text can render heavier than the system allows.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "EIB",
  description: "Entrepreneurship, Innovation & Business: a venture track inside the school timetable.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable} ${cormorant.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
