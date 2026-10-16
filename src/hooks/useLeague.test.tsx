import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSeason, WeekLoadError } from "~/hooks/useLeague";
import { GAME_ID, TEAMS } from "~/lib/test-utils/fixtures";
import { queryWrapper, stubFetch } from "~/lib/test-utils/query";

/** A week's scoreboard with one game, or none. */
function scoreboard(season: number, week: number, games: number) {
  return {
    season: { year: season, type: 2 },
    week: { number: week },
    events: Array.from({ length: games }, (_, index) => ({
      id: `${GAME_ID}${week}${index}`,
      date: `${season}-10-11T17:00:00Z`,
      week: { number: week },
      competitions: [
        {
          status: { type: { name: "STATUS_FINAL", state: "post" } },
          competitors: [
            { homeAway: "home", team: { id: TEAMS.NO.teamId }, score: "13" },
            { homeAway: "away", team: { id: TEAMS.MIN.teamId }, score: "23" },
          ],
        },
      ],
    })),
  };
}

function params(url: string) {
  const query = new URL(url).searchParams;
  return {
    season: Number(query.get("dates")),
    type: Number(query.get("seasontype")),
    week: Number(query.get("week")),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSeason", () => {
  it("fetches every week of the current season once, week 1 included", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    const fetchMock = stubFetch((url) => {
      const { season, type, week } = params(url);
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const { season, weeks } = result.current.data!;
    expect(season.season).toBe(2026);
    expect(season.games).toHaveLength(18);
    expect(weeks.size).toBe(22);
    // Regular season and the four rounds, each once.
    expect(fetchMock).toHaveBeenCalledTimes(22);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) =>
          params(String(url)).week === 1 && params(String(url)).type === 2,
      ),
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it("falls back to the season before while ESPN has no schedule yet", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2027-04-01T12:00:00Z"));
    stubFetch((url) => {
      const { season, week } = params(url);
      return scoreboard(season, week, season === 2026 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.season.season).toBe(2026);
    vi.useRealTimers();
  });

  it("fetches every week at once, waiting on nothing first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    const fetchMock = stubFetch((url) => {
      const { season, week, type } = params(url);
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    renderHook(() => useSeason(), { wrapper: queryWrapper() });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(22));
    vi.useRealTimers();
  });

  it("names the week that cannot be loaded, and why", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    stubFetch((url) => {
      const { season, week, type } = params(url);
      if (type === 2 && week === 7) return new Response(null, { status: 503 });
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(WeekLoadError);
    expect(result.current.error?.message).toBe("Week 7 could not be loaded");
    expect((result.current.error as WeekLoadError).cause.message).toMatch(
      /503/,
    );
    vi.useRealTimers();
  });

  it("reports the season, not a week, when more than one week fails", async () => {
    stubFetch(() => new Response(null, { status: 503 }));
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).not.toBeInstanceOf(WeekLoadError);
    expect(result.current.error?.message).toMatch(/503/);
  });

  it("reports a season ESPN has for neither year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2027-04-01T12:00:00Z"));
    stubFetch((url) => {
      const { season, week } = params(url);
      return scoreboard(season, week, 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(
      /no schedule for 2027 or 2026/,
    );
    vi.useRealTimers();
  });
});
