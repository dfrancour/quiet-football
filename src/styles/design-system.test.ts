import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE } from "~/lib/palette";

const SRC = join(process.cwd(), "src");
const CSS = readFileSync(join(SRC, "styles/globals.css"), "utf8");

/** Each `--color-*` token's `oklch` lightness, chroma and hue. */
const TOKENS = new Map(
  [
    ...CSS.matchAll(
      /--color-([\w-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\);/g,
    ),
  ].map((m) => [
    m[1] ?? "",
    [Number(m[2]) / 100, Number(m[3]), Number(m[4])] as const,
  ]),
);

function token(name: string): readonly [number, number, number] {
  const found = TOKENS.get(name);
  if (!found) throw new Error(`No --color-${name} in globals.css`);
  return found;
}

/** Linear sRGB, clipped, from Björn Ottosson's OKLab matrices. */
function linear([l, c, h]: readonly [number, number, number]): number[] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
}

function hex(color: readonly [number, number, number]): string {
  return `#${linear(color)
    .map((channel) => {
      const encoded =
        channel <= 0.0031308
          ? 12.92 * channel
          : 1.055 * channel ** (1 / 2.4) - 0.055;
      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

function contrast(fg: string, bg: string): number {
  const luminance = (name: string) => {
    const [r = 0, g = 0, b = 0] = linear(token(name));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Every component's source, tests aside. */
const SOURCES = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx$/.test(file) && !file.includes(".test."))
  .map((file) => ({ file, text: readFileSync(join(SRC, file), "utf8") }));

function offenders(pattern: RegExp): string[] {
  return SOURCES.flatMap(({ file, text }) =>
    [...text.matchAll(pattern)].map((m) => `${file}: ${m[0]}`),
  );
}

describe("the theme", () => {
  it("is what the colours outside the stylesheet are", () => {
    expect(PALETTE.surface).toBe(hex(token("surface")));
    expect(PALETTE.inkMuted).toBe(hex(token("ink-muted")));
    expect(PALETTE.inkFaint).toBe(hex(token("ink-faint")));
  });

  it("draws every ink legibly as small text on either surface", () => {
    for (const ink of ["ink", "ink-muted", "ink-faint"]) {
      for (const surface of ["surface", "surface-raised"]) {
        expect(contrast(ink, surface), `${ink} on ${surface}`).toBeGreaterThan(
          4.5,
        );
      }
    }
  });
});

describe("the components", () => {
  it("are all read", () => {
    expect(SOURCES.length).toBeGreaterThan(30);
  });

  it("leave the pointer and touch to the base layer", () => {
    expect(offenders(/\bcursor-(pointer|default)\b/g)).toEqual([]);
    expect(offenders(/\btouch-(manipulation|auto)\b/g)).toEqual([]);
  });

  it("set text on the theme's scale", () => {
    expect(offenders(/\btext-\[[\d.]+(rem|px|em)\]/g)).toEqual([]);
    expect(offenders(/\btracking-\[[^\]]+\]/g)).toEqual([]);
  });

  it("colour only with the theme's tokens", () => {
    expect(
      offenders(
        /\b(text|bg|border|fill|stroke|ring|outline|from|to|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/g,
      ),
    ).toEqual([]);
    expect(offenders(/#[\da-f]{6}\b|oklch\(/gi)).toEqual([]);
  });
});
