import { describe, expect, it } from "vitest";
import { hueOf, teamTint } from "~/lib/team-tint";

const tint = (color: string | null, alternateColor: string | null = null) =>
  teamTint({ color, alternateColor });

describe("teamTint", () => {
  it("keeps a team's hue at one lightness, its chroma within bounds", () => {
    // Minnesota's purple, as ESPN sends it.
    expect(tint("4f2683")).toBe("oklch(0.64 0.148 299.4)");
    // Kansas City's red is reined in, Dallas's navy brought up.
    expect(tint("e31837")).toBe("oklch(0.64 0.160 22.2)");
    expect(tint("002a5c")).toBe("oklch(0.64 0.120 256.1)");
  });

  it("takes the alternate color when ESPN's is black", () => {
    // Pittsburgh: black, then gold.
    expect(tint("000000", "ffb612")).toBe("oklch(0.64 0.160 79.0)");
  });

  it("falls back to the site's accent with no hue to keep", () => {
    // Las Vegas: black, then silver.
    expect(tint("000000", "a5acaf")).toBe("var(--color-accent)");
    expect(tint(null)).toBe("var(--color-accent)");
    expect(tint("nope")).toBe("var(--color-accent)");
  });
});

describe("hueOf", () => {
  it("reads OKLCH chroma and hue from hex", () => {
    expect(hueOf("ffffff")?.chroma).toBeCloseTo(0, 3);
    expect(hueOf("ff0000")?.hue).toBeCloseTo(29.2, 0);
    expect(hueOf("ff0000")?.chroma).toBeCloseTo(0.258, 2);
    expect(hueOf("#ff0000")).toBeNull();
  });
});
