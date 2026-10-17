import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECAPS_STALE_MS, useRecaps } from "~/hooks/useRecaps";
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

  it("never polls: it looks again only for a recent game still without a recap, and only once an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-12T12:00:00Z"));
    const fetchMock = stubFetch(() => nothingFound);
    const { result, rerender } = renderHook(
      ({ game }) => useRecaps(season, REGISTRY, game),
      { wrapper: queryWrapper(), initialProps: { game: selected } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.recaps).toEqual({});

    // Still fresh: turning to another unlinked game asks nothing.
    rerender({ game: OTHER });
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // An hour on, turning to a game is a reason to look once.
    vi.setSystemTime(Date.now() + RECAPS_STALE_MS + 1);
    rerender({ game: selected });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("looks again for nothing that is old, or already linked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-12T12:00:00Z"));
    const fetchMock = stubFetch(() => dataset);
    const { rerender } = renderHook(
      ({ game }) => useRecaps(season, REGISTRY, game),
      {
        wrapper: queryWrapper(),
        initialProps: { game: null as typeof selected | null },
      },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    vi.setSystemTime(Date.now() + 2 * RECAPS_STALE_MS);
    // Linked already.
    rerender({ game: selected });
    // A game from weeks ago: its recap came or never will.
    rerender({ game: { ...OTHER, kickoff: "2026-09-13T17:00:00.000Z" } });
    await new Promise((done) => setTimeout(done, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
