import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInterestingGames } from "~/hooks/useInteresting";
import {
  resetMarkInterestingCache,
  setMarkInteresting,
} from "~/lib/interesting";
import {
  makeQueryClient,
  queryWrapper,
  stubFetch,
} from "~/lib/test-utils/query";
import { savedSwings, saveSwings } from "~/lib/week-store";

const CLASSIC = "401872987";
const ROUT = "401872999";

/** ESPN's feed: a back-and-forth game for one, a rout for the other. */
function feed(url: string) {
  const chances = url.includes(CLASSIC)
    ? [0.5, 0.9, 0.1, 0.9, 0.1, 0.9, 0.2, 1]
    : [0.5, 0.7, 0.85, 0.95, 1];
  return { items: chances.map((homeWinPercentage) => ({ homeWinPercentage })) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetMarkInterestingCache();
});

describe("useInterestingGames", () => {
  it("asks ESPN nothing while marks are off", () => {
    const fetchMock = stubFetch(feed);
    const { result } = renderHook(
      () => useInterestingGames(2026, [CLASSIC, ROUT]),
      { wrapper: queryWrapper() },
    );
    expect(result.current.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("finds the games worth watching among those given, and saves how each turned", async () => {
    setMarkInteresting(true);
    const fetchMock = stubFetch(feed);
    const { result } = renderHook(
      () => useInterestingGames(2026, [CLASSIC, ROUT]),
      { wrapper: queryWrapper() },
    );
    await waitFor(() => expect([...result.current]).toEqual([CLASSIC]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(savedSwings(2026, ROUT)).not.toBeNull();
  });

  it("reads a game saved by an earlier visit without asking again", async () => {
    setMarkInteresting(true);
    saveSwings(2026, CLASSIC, { swing: 6, winnerLow: 0.3, complete: true });
    const fetchMock = stubFetch(feed);
    const { result } = renderHook(() => useInterestingGames(2026, [CLASSIC]), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect([...result.current]).toEqual([CLASSIC]));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not save a feed still catching up with the final plays", async () => {
    setMarkInteresting(true);
    stubFetch(() => ({
      items: [{ homeWinPercentage: 0.5 }, { homeWinPercentage: 0.93 }],
    }));
    const client = makeQueryClient();
    renderHook(() => useInterestingGames(2026, [CLASSIC]), {
      wrapper: queryWrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryData(["swings", CLASSIC])).toMatchObject({
        complete: false,
      }),
    );
    expect(savedSwings(2026, CLASSIC)).toBeNull();
  });
});
