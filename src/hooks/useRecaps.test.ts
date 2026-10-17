import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameEndedAt, recapsPollMs, useRecaps } from "~/hooks/useRecaps";
import { noteGameClock } from "~/lib/game-clocks";
import {
  GAME_ID,
  REGISTRY,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";
import { queryWrapper, stubFetch } from "~/lib/test-utils/query";

const KICKOFF = "2026-10-11T17:00:00.000Z";
const season = makeSeason([makeSeasonGame({ status: "final" })]);
const selected = { gameId: GAME_ID, status: "final", kickoff: KICKOFF };
const OTHER = { gameId: "401872999", status: "final", kickoff: KICKOFF };

/** The dataset's file for the season, with MIN at NO found. */
const dataset = {
  season: 2026,
  games: [
    {
      season_type: "regular",
      week: 5,
      away: "MIN",
      home: "NO",
      status: "found",
      video: {
        youtube_id: "GP9zR_SKRr0",
        published_at: "2026-10-11T20:41:07Z",
      },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const nothingFound = { season: 2026, games: [] };

describe("useRecaps", () => {
  it("reads the season's file from the dataset and keys each recap by game", async () => {
    const fetchMock = stubFetch(() => dataset);
    const { result } = renderHook(() => useRecaps(season, REGISTRY, selected), {
      wrapper: queryWrapper(),
    });
    await waitFor(() =>
      expect(result.current.recaps[GAME_ID]).toEqual({
        youtubeId: "GP9zR_SKRr0",
        publishedAt: "2026-10-11T20:41:07Z",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/2026\.json$/);
  });

  it("has no recaps while the dataset cannot be read", async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    const { result } = renderHook(() => useRecaps(season, REGISTRY, null), {
      wrapper: queryWrapper(),
    });
    await new Promise((done) => setTimeout(done, 20));
    expect(result.current).toEqual({ season: 2026, recaps: {} });
  });

  it("looks often right after a game ends, then less, then not at all", () => {
    const hour = 60 * 60_000;
    expect(recapsPollMs(-10 * 60_000)).toBe(5 * 60_000);
    expect(recapsPollMs(1 * hour)).toBe(5 * 60_000);
    expect(recapsPollMs(5 * hour)).toBe(5 * 60_000);
    expect(recapsPollMs(12 * hour)).toBe(30 * 60_000);
    expect(recapsPollMs(48 * hour)).toBe(2 * hour);
    expect(recapsPollMs(80 * hour)).toBe(false);
  });

  it("counts from when the game went final, or a typical game after kickoff", () => {
    const clock = {
      detail: "Final",
      period: 4,
      clock: "0:00",
      completed: true,
    };
    noteGameClock("seen", { ...clock, completed: false }, 1_000);
    noteGameClock("seen", clock, 61_000);
    expect(gameEndedAt("seen", KICKOFF)).toBe(61_000);
    expect(gameEndedAt("unseen", KICKOFF)).toBe(
      Date.parse(KICKOFF) + 3 * 60 * 60_000 + 15 * 60_000,
    );
  });

  it("polls only while the selected game is final, recent and still unlinked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-11T22:00:00Z"));
    const fetchMock = stubFetch(() => nothingFound);
    const { rerender } = renderHook(
      ({ game }) => useRecaps(season, REGISTRY, game),
      { wrapper: queryWrapper(), initialProps: { game: selected } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // A game from weeks ago is not waited on.
    rerender({ game: { ...OTHER, kickoff: "2026-09-13T17:00:00.000Z" } });
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops once the recap is linked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-11T22:00:00Z"));
    const fetchMock = stubFetch(() => dataset);
    const { result } = renderHook(() => useRecaps(season, REGISTRY, selected), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.recaps[GAME_ID]).toBeDefined());
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
