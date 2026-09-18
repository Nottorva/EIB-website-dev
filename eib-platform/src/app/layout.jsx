import "./globals.css";
import { Archivo, Newsreader, IBM_Plex_Mono } from "next/font/google";

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

export const metadata = {
  title: "EIB",
  description: "Entrepreneurship, Innovation & Business: a venture track inside the school timetable.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
