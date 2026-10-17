import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollAway } from "~/hooks/useScrollAway";

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("useScrollAway", () => {
  afterEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("goes on the way down and comes back on the way up", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 5000,
      configurable: true,
    });
    const { result } = renderHook(() => useScrollAway());
    expect(result.current).toBe(false);

    scrollTo(300);
    expect(result.current).toBe(true);
    // A nudge either way moves nothing.
    scrollTo(296);
    expect(result.current).toBe(true);
    scrollTo(200);
    expect(result.current).toBe(false);
    scrollTo(600);
    expect(result.current).toBe(true);
    scrollTo(20);
    expect(result.current).toBe(false);
  });

  it("comes back at the end of the page", () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: window.innerHeight + 400,
      configurable: true,
    });
    const { result } = renderHook(() => useScrollAway());
    scrollTo(200);
    expect(result.current).toBe(true);
    scrollTo(400);
    expect(result.current).toBe(false);
  });
});
