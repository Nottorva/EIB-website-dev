// joineib.ca design tokens (see DESIGN.md). This is the one place colours and
// fonts are named for JavaScript; globals.css carries the same values as CSS
// variables (keep the two in step). Hex values, not var(...), because icons
// take a colour as an SVG attribute, where CSS variables do not work.
//
// No "use client" here on purpose, so server pages can import it too.

export const COLORS = {
  bg: "#F5F3EE", // page background
  surface: "#FFFDF8", // cards, sections, inputs
  ink: "#14213D", // primary text, primary button, borders that need weight
  inkHover: "#0B1427",
  text2: "#3A4352", // body text inside cards
  muted: "#4A5568", // labels, captions, secondary text
  border: "#E2DED5", // card and section borders
  border2: "#C9C3B6", // tertiary button and input borders
  accent: "#A67C2E", // brass: rules, frames, seals. Never text.
  successBg: "#E8F3EC",
  successBorder: "#B7D7C2",
  successText: "#1E4D2E",
  successIcon: "#1E6B3A",
  // Error and warning follow the success pattern (pale ground, mid border,
  // dark text). They are not in DESIGN.md's token list; it asks for them.
  errorBg: "#F7EAE7",
  errorBorder: "#E3C0BA",
  errorText: "#7A1F1A",
  errorIcon: "#A12A22",
  warnBg: "#F6EFDF",
  warnBorder: "#E2D2A8",
  warnText: "#5C4310",
  warnIcon: "#8A6516",
  disabled: "#C9C3B6", // a button that cannot be pressed
  white: "#FFFFFF", // text on ink
  scrim: "rgba(20,33,61,0.55)", // the dimmed page behind a dialog
};

// The same object under the name the shared components use.
export const TOKENS = COLORS;

export const FONTS = {
  serif: 'var(--font-cormorant), "Cormorant Garamond", Georgia, "Times New Roman", serif',
  sans: 'var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};
