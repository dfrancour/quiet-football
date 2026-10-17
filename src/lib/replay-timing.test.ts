import { describe, expect, it } from "vitest";
import { DEFAULT_TIMING, parseTiming, replayTiming } from "~/lib/replay-timing";

describe("parseTiming", () => {
  it("reads lined up, draw and hold in milliseconds", () => {
    expect(parseTiming("2500, 1100,2500")).toEqual({
      lineUpMs: 2500,
      drawMs: 1100,
      holdMs: 2500,
    });
  });

  it("refuses anything but three whole numbers with a draw", () => {
    expect(parseTiming("")).toBeNull();
    expect(parseTiming("1000,500")).toBeNull();
    expect(parseTiming("1000,0,500")).toBeNull();
    expect(parseTiming("fast,1100,2000")).toBeNull();
    expect(parseTiming("1000,1100,-1")).toBeNull();
  });
});

describe("replayTiming", () => {
  it("is the default outside development", () => {
    expect(replayTiming()).toBe(DEFAULT_TIMING);
  });
});
