// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gameClockAsOf, noteGameClock } from "~/lib/game-clocks";

const at = (clock: string) => ({
  detail: `${clock} - 3rd`,
  period: 3,
  clock,
  completed: false,
});

describe("game clocks", () => {
  it("gives the clock as it stood at a moment", () => {
    noteGameClock("g", at("9:00"), 1_000);
    noteGameClock("g", at("8:00"), 31_000);
    noteGameClock("g", at("7:00"), 61_000);
    expect(gameClockAsOf("g", 30_000)?.clock).toBe("9:00");
    expect(gameClockAsOf("g", 31_000)?.clock).toBe("8:00");
    expect(gameClockAsOf("g", 90_000)?.clock).toBe("7:00");
  });

  it("gives the earliest it has for a moment before the page opened", () => {
    noteGameClock("g", at("9:00"), 50_000);
    expect(gameClockAsOf("g", 20_000)?.clock).toBe("9:00");
    expect(gameClockAsOf("other", 20_000)).toBeNull();
  });

  it("keeps a clock that has not moved as of when it was first seen", () => {
    noteGameClock("g", at("9:00"), 1_000);
    noteGameClock("g", at("9:00"), 40_000);
    noteGameClock("g", at("8:00"), 41_000);
    expect(gameClockAsOf("g", 30_000)?.clock).toBe("9:00");
  });

  it("forgets what is older than any delay needs", () => {
    noteGameClock("g", at("9:00"), 0);
    noteGameClock("g", at("8:00"), 10_000);
    noteGameClock("g", at("7:00"), 10 * 60_000);
    // The newest before the window still stands for its start.
    expect(gameClockAsOf("g", 0)?.clock).toBe("8:00");
  });
});
