// Two tiny easing helpers shared by the scroll-driven pieces of the site.
export const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);
export const smooth = (t) => t * t * (3 - 2 * t);
