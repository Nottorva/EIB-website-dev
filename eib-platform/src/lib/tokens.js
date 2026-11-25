// joineib.ca design tokens (see DESIGN.md). This is the one place colours and
// fonts are named for JavaScript; globals.css carries the same values as CSS
// variables (keep the two in step). Hex values, not var(...), because icons
// take a colour as an SVG attribute, where CSS variables do not work.
//
// No "use client" here on purpose, so server pages can import it too.

export const COLORS = {
  bg: "#ECE8DF", // page background: deep enough that white cards stand off it
  surface: "#FFFFFF", // cards, sections, inputs
  ink: "#14213D", // primary text, primary button, borders that need weight
  inkHover: "#0B1427",
  text2: "#3A4352", // body text inside cards
  muted: "#5E6878", // labels, captions, secondary text: clearly lighter than ink
  border: "#D3CCBD", // card and section borders
  border2: "#A39B8A", // tertiary button and input borders
  accent: "#A67C2E", // brass: rules, frames, seals. Never text.
  // The action colour: anything you press to make something happen (main
  // buttons, links). Ink stays for text and for "you are here" (the open tab,
  // the current lesson), so the two never read as the same thing.
  action: "#1B4FD8",
  actionHover: "#143DAE",
  actionBg: "#E9EFFD", // pale tint: hover grounds, the AIDA callout
  actionBorder: "#B4C6F4",
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
  disabled: "#B9B3A6", // a button that cannot be pressed
  white: "#FFFFFF", // text on ink
  scrim: "rgba(20,33,61,0.55)", // the dimmed page behind a dialog
};

// The same object under the name the shared components use.
export const TOKENS = COLORS;

export const FONTS = {
  serif: 'var(--font-cormorant), "Cormorant Garamond", Georgia, "Times New Roman", serif',
  sans: 'var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};
