import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSwings,
  getMarkInteresting,
  isInteresting,
  resetMarkInterestingCache,
  setMarkInteresting,
  swingsOf,
} from "~/lib/interesting";
import { requestUrl, stubFetch } from "~/lib/test-utils/query";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetMarkInterestingCache();
});

describe("swingsOf", () => {
  it("adds up every move in the home side's chance", () => {
    const { swing } = swingsOf([0.5, 0.7, 0.4, 0.9, 1]);
    expect(swing).toBeCloseTo(0.2 + 0.3 + 0.5 + 0.1);
  });

  it("finds how low the winner fell, from either side", () => {
    expect(swingsOf([0.6, 0.3, 0.02, 0.4, 1]).winnerLow).toBe(0.02);
    expect(swingsOf([0.4, 0.97, 0.5, 0]).winnerLow).toBeCloseTo(0.03);
  });

  it("names no winner in a tie", () => {
    expect(swingsOf([0.5, 0.8, 0.5])).toMatchObject({
      winnerLow: null,
      complete: true,
    });
  });

  it("is complete only once the feed settles the game", () => {
    expect(swingsOf([0.5, 0.8, 1]).complete).toBe(true);
    expect(swingsOf([0.5, 0.8, 0]).complete).toBe(true);
    expect(swingsOf([0.5, 0.8, 0.97]).complete).toBe(false);
  });

  it("reads an empty feed as a game that never turned", () => {
    expect(swingsOf([])).toEqual({ swing: 0, winnerLow: null, complete: true });
  });
});

describe("isInteresting", () => {
  it("marks a game that turned and turned again", () => {
    expect(isInteresting({ swing: 6.2, winnerLow: 0.3, complete: true })).toBe(
      true,
    );
  });

  it("marks a comeback from all but beaten, however little else it turned", () => {
    expect(isInteresting({ swing: 3.1, winnerLow: 0.03, complete: true })).toBe(
      true,
    );
  });

  it("leaves an ordinary game and a rout unmarked", () => {
    expect(isInteresting({ swing: 3.6, winnerLow: 0.4, complete: true })).toBe(
      false,
    );
    expect(isInteresting({ swing: 0.8, winnerLow: 0.55, complete: true })).toBe(
      false,
    );
    expect(isInteresting({ swing: 3, winnerLow: null, complete: true })).toBe(
      false,
    );
  });
});

describe("fetchSwings", () => {
  it("reads ESPN's win probability for the game, play by play", async () => {
    const fetchMock = stubFetch(() => ({
      count: 3,
      items: [
        { homeWinPercentage: 0.6, tiePercentage: 0 },
        { homeWinPercentage: 0.2, tiePercentage: 0 },
        { homeWinPercentage: 1, tiePercentage: 0 },
      ],
    }));
    const swings = await fetchSwings("401872987");
    expect(swings.swing).toBeCloseTo(1.2);
    expect(swings.winnerLow).toBe(0.2);
    expect(requestUrl(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/401872987/competitions/401872987/probabilities?limit=1000",
    );
  });

  it("refuses a payload that is not a feed", async () => {
    stubFetch(() => ({ items: [{ homeWinPercentage: "high" }] }));
    await expect(fetchSwings("401872987")).rejects.toThrow();
  });
});

describe("marking interesting games", () => {
  it("is off until asked for, and kept", () => {
    expect(getMarkInteresting()).toBe(false);
    setMarkInteresting(true);
    resetMarkInterestingCache();
    expect(getMarkInteresting()).toBe(true);
  });
});
