import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRecaps } from "~/hooks/useRecaps";
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
});

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
});
