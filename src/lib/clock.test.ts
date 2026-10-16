import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToClock } from "~/lib/clock";

describe("subscribeToClock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks once a second by default", () => {
    const listener = vi.fn();
    const stop = subscribeToClock(listener);
    vi.advanceTimersByTime(3_000);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });

  it("runs finer for a finer subscriber, still telling the rest each second", () => {
    const slow = vi.fn();
    const fast = vi.fn();
    const stopSlow = subscribeToClock(slow);
    const stopFast = subscribeToClock(fast, 100);
    vi.advanceTimersByTime(1_000);
    expect(fast).toHaveBeenCalledTimes(10);
    expect(slow).toHaveBeenCalledTimes(1);

    // Back to a second a tick once the finer subscriber leaves.
    stopFast();
    vi.advanceTimersByTime(2_000);
    expect(slow).toHaveBeenCalledTimes(3);
    expect(fast).toHaveBeenCalledTimes(10);
    stopSlow();
  });
});
