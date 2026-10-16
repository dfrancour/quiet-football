import { describe, expect, it } from "vitest";
import { isOnField, lineToGain, spotLabel } from "~/lib/field";

/** Spots from SF at SEA, 2026 week 5: Seattle is home, so its goal is 0. */
describe("field frame", () => {
  it("names spots by the half of the field they are in", () => {
    expect(spotLabel(45, "SEA", "SF")).toBe("SEA 45");
    expect(spotLabel(74, "SEA", "SF")).toBe("SF 26");
    expect(spotLabel(50, "SEA", "SF")).toBe("50");
  });

  it("puts the line to gain ahead of the home offense by counting up", () => {
    // SEA, 4th & 10 at SF 22.
    expect(lineToGain(78, 10, "home")).toBe(88);
  });

  it("puts the line to gain ahead of the away offense by counting down", () => {
    // SF, 1st & 10 at SF 26.
    expect(lineToGain(74, 10, "away")).toBe(64);
  });

  it("has no line to gain when it is goal to go", () => {
    expect(lineToGain(95, 5, "home")).toBeNull();
    expect(lineToGain(3, 3, "away")).toBeNull();
  });

  it("accepts only spots between the goal lines", () => {
    expect(isOnField(0)).toBe(true);
    expect(isOnField(100)).toBe(true);
    expect(isOnField(-1)).toBe(false);
    expect(isOnField(null)).toBe(false);
    expect(isOnField(Number.NaN)).toBe(false);
  });
});
