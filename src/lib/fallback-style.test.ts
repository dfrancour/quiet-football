import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FALLBACK_STYLE, SUPPORTED_COLOR } from "~/lib/fallback-style";

describe("FALLBACK_STYLE", () => {
  it("is skipped whole by a browser that can draw the site", () => {
    const rules = FALLBACK_STYLE.split("\n");
    expect(rules[0]).toBe(`@supports not (color:${SUPPORTED_COLOR}){`);
    expect(rules.at(-1)).toBe("}");
    for (const rule of rules.slice(1, -1))
      expect(rule).toMatch(/^[^{}]+\{[^{}]+\}$/);
  });

  it("asks after the format every colour of the theme is in", () => {
    const css = readFileSync(
      join(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );
    const colors = [...css.matchAll(/--color-[\w-]+:\s*([^;]+);/g)].map(
      (m) => m[1],
    );
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect(color).toMatch(/^oklch\(/);
  });
});
