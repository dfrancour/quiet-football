/**
 * The theme's colours where the stylesheet does not reach, as hex: the frame
 * a browser without `oklch` draws (`FALLBACK_STYLE`), and the browser's and
 * an installed app's own bars. Each is its token in `globals.css`, converted,
 * and a test holds it there.
 */
export const PALETTE = {
  surface: "#0e0c12",
  inkMuted: "#a6a3ac",
  inkFaint: "#84818c",
} as const;

/**
 * The ground the site's icons are drawn on (`icon.svg` rendered to the PNGs
 * in `public/` and `app/apple-icon.png`), a shade above the page so the mark
 * reads on a dark home screen. An installed app's splash surrounds its icon
 * with it.
 */
export const ICON_GROUND = "#1a1420";
