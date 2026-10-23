import { type CSSProperties } from "react";
import { type Team } from "~/lib/teams.schema";

/**
 * A favorite team's tint: its color's hue at one lightness and a narrow
 * range of chroma, so navy, gold and red read alike against the dark
 * surface and none glares. ESPN gives a few teams black or near-black, which
 * has no hue to keep and would tint like the grey of a hovered row; those
 * take their alternate color (Pittsburgh's gold), and a team with neither
 * takes the site's accent.
 */

const LIGHTNESS = 0.64;
const MIN_CHROMA = 0.12;
const MAX_CHROMA = 0.16;
/** Below this a color is grey: its hue says nothing. */
const HUE_CHROMA = 0.05;

const ACCENT = "var(--color-accent)";

interface Hue {
  chroma: number;
  hue: number;
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** OKLCH chroma and hue of a hex color without the hash; null if malformed. */
export function hueOf(hex: string): Hue | null {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [0, 2, 4].map((at) =>
    linear(parseInt(hex.slice(at, at + 2), 16)),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return { chroma: Math.hypot(a, bb), hue: (hue + 360) % 360 };
}

/** The team's tint as a CSS color. */
export function teamTint(team: Pick<Team, "color" | "alternateColor">): string {
  const found = [team.color, team.alternateColor]
    .map((hex) => (hex ? hueOf(hex) : null))
    .find((hue) => hue !== null && hue.chroma >= HUE_CHROMA);
  if (!found) return ACCENT;
  const chroma = Math.min(MAX_CHROMA, Math.max(MIN_CHROMA, found.chroma));
  return `oklch(${LIGHTNESS} ${chroma.toFixed(3)} ${found.hue.toFixed(1)})`;
}

/** The style that hands `.team-tint` the team's color. */
export function tintStyle(
  team: Pick<Team, "color" | "alternateColor">,
): CSSProperties {
  return { "--team-tint": teamTint(team) } as CSSProperties;
}
