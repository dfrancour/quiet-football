import { describe, expect, it } from "vitest";
import {
  broadcastPhase,
  cycleBroadcastDelay,
  getBroadcastDelays,
  nextBroadcastDelay,
} from "~/lib/broadcast-delay";

const clock = (completed: boolean) => ({
  detail: completed ? "Final" : "2:00 - 4th",
  period: 4,
  clock: completed ? "0:00" : "2:00",
  completed,
});

describe("broadcast delay", () => {
  it("steps through the delays and back to none", () => {
    expect(nextBroadcastDelay(0)).toBe(10);
    expect(nextBroadcastDelay(60)).toBe(0);
  });

  it("is kept per game, and none is not kept at all", () => {
    cycleBroadcastDelay("a");
    cycleBroadcastDelay("a");
    cycleBroadcastDelay("b");
    expect(getBroadcastDelays()).toEqual({ a: 20, b: 10 });
    for (let step = 0; step < 5; step += 1) cycleBroadcastDelay("b");
    expect(getBroadcastDelays()).toEqual({ a: 20 });
  });

  it("keeps a game live until the delayed broadcast reaches its end", () => {
    expect(broadcastPhase("final", clock(false))).toBe("live");
    expect(broadcastPhase("final", clock(true))).toBe("final");
    // Without a delay, or anything noted, the store decides.
    expect(broadcastPhase("final", undefined)).toBe("final");
    expect(broadcastPhase("final", null)).toBe("final");
    expect(broadcastPhase("upcoming", clock(false))).toBe("upcoming");
  });
});
