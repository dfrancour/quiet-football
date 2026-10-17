import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSeason, useTeams, WeekLoadError } from "~/hooks/useLeague";
import { scoreConfig } from "~/lib/config";
import { GAME_ID, TEAMS } from "~/lib/test-utils/fixtures";
import { queryWrapper, stubFetch } from "~/lib/test-utils/query";
import { savedTeams, savedWeek, saveWeek } from "~/lib/week-store";

/** A week's scoreboard with one game, or none; final unless told otherwise. */
function scoreboard(
  season: number,
  week: number,
  games: number,
  status = { name: "STATUS_FINAL", state: "post" },
  date = `${season}-10-11T17:00:00Z`,
) {
  return {
    season: { year: season, type: 2 },
    week: { number: week },
    events: Array.from({ length: games }, (_, index) => ({
      id: `${GAME_ID}${week}${index}`,
      date,
      week: { number: week },
      competitions: [
        {
          status: { type: status },
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

const NOW = Date.parse("2026-10-16T12:00:00Z");
const SCHEDULED = { name: "STATUS_SCHEDULED", state: "pre" };
/** A kickoff still to come, as of NOW. */
const LATER = "2026-10-18T17:00:00Z";
const IN_PROGRESS = { name: "STATUS_IN_PROGRESS", state: "in" };

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
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
    // The regular season and the Wild Card round, each once; a round not
    // yet set holds the rounds after it.
    expect(fetchMock).toHaveBeenCalledTimes(19);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) =>
          params(String(url)).week === 1 && params(String(url)).type === 2,
      ),
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it("reads a settled week saved by an earlier visit instead of fetching it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    saveWeek(2026, 3, scoreboard(2026, 3, 1), NOW - 30 * 24 * 60 * 60_000);
    const fetchMock = stubFetch((url) => {
      const { season, type, week } = params(url);
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.weeks.get(3)?.games).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(18);
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          params(String(url)).week === 3 && params(String(url)).type === 2,
      ),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("saves every week it fetches unless a game in it is under way", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    stubFetch((url) => {
      const { season, type, week } = params(url);
      if (type !== 2) return scoreboard(season, week, 0);
      if (week === 7) return scoreboard(season, week, 1, SCHEDULED, LATER);
      if (week === 6) return scoreboard(season, week, 1, IN_PROGRESS);
      return scoreboard(season, week, 1);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(savedWeek(2026, 5)?.savedAt).toBe(NOW);
    expect(savedWeek(2026, 7)?.savedAt).toBe(NOW);
    expect(savedWeek(2026, 6)).toBeNull();
    // A round not yet set has no games; it is ahead, and kept as such.
    expect(savedWeek(2026, 19)?.savedAt).toBe(NOW);
    vi.useRealTimers();
  });

  it("trusts a saved week still ahead for hours, then asks again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const ahead = (week: number) => scoreboard(2026, week, 1, SCHEDULED, LATER);
    saveWeek(2026, 7, ahead(7), NOW - scoreConfig.aheadStaleMs / 2);
    saveWeek(2026, 8, ahead(8), NOW - scoreConfig.aheadStaleMs * 2);
    const fetchMock = stubFetch((url) => {
      const { season, type, week } = params(url);
      return week >= 7 && type === 2
        ? ahead(week)
        : scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const weeksFetched = fetchMock.mock.calls
      .map(([url]) => params(String(url)))
      .filter(({ type }) => type === 2)
      .map(({ week }) => week);
    expect(weeksFetched).not.toContain(7);
    expect(weeksFetched).toContain(8);
    expect(result.current.data?.weeks.get(7)?.updatedAt).toBe(
      NOW - scoreConfig.aheadStaleMs / 2,
    );
    expect(savedWeek(2026, 8)?.savedAt).toBe(NOW);
    vi.useRealTimers();
  });

  it("asks again for a saved week whose game has since kicked off", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    // Saved before kickoff, which the scoreboard puts an hour ago.
    saveWeek(2026, 7, scoreboard(2026, 7, 1, SCHEDULED), NOW - 60_000);
    const fetchMock = stubFetch((url) => {
      const { season, type, week } = params(url);
      return week === 7 && type === 2
        ? scoreboard(season, week, 1, IN_PROGRESS)
        : scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          params(String(url)).week === 7 && params(String(url)).type === 2,
      ),
    ).toBe(true);
    expect(result.current.data?.weeks.get(7)?.games[0]?.status).toBe(
      "in_progress",
    );
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

  it("asks for a playoff round only once the week before it is settled", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    const fetchMock = stubFetch((url) => {
      const { season, type, week } = params(url);
      if (type === 3) return scoreboard(season, week, 0);
      return week <= 6
        ? scoreboard(season, week, 1)
        : scoreboard(season, week, 1, SCHEDULED, LATER);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.weeks.size).toBe(22);
    expect(result.current.data?.weeks.get(19)?.games).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(18);
    expect(
      fetchMock.mock.calls.some(([url]) => params(String(url)).type === 3),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("names the week that cannot be loaded when the rounds after it fail with it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    stubFetch((url) => {
      const { season, type, week } = params(url);
      if (type === 2 && week === 18) return new Response(null, { status: 503 });
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useSeason(), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBeInstanceOf(WeekLoadError);
    expect((result.current.error as WeekLoadError).weekName).toBe("Week 18");
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(19));
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

/** ESPN's standings, every team under its division. */
function standings() {
  const division = (
    name: string,
    teams: (typeof TEAMS)[keyof typeof TEAMS][],
  ) => ({
    name,
    standings: {
      entries: teams.map((team) => ({
        team: { id: team.teamId, abbreviation: team.abbreviation },
        stats: [{ name: "playoffSeed", value: 1 }],
      })),
    },
  });
  return {
    children: [
      {
        abbreviation: "NFC",
        children: [
          division("NFC North", [TEAMS.MIN]),
          division("NFC South", [TEAMS.NO]),
        ],
      },
    ],
  };
}

describe("useTeams", () => {
  it("reads one standings call for the season, and keeps the registry for the next visit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const fetchMock = stubFetch((url) => {
      if (url.includes("/standings")) return standings();
      const { season, type, week } = params(url);
      return scoreboard(season, week, type === 2 ? 1 : 0);
    });
    const { result } = renderHook(() => useTeams(2026), {
      wrapper: queryWrapper(),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const standingsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/standings"),
    );
    expect(standingsCalls).toHaveLength(1);
    expect(String(standingsCalls[0]?.[0])).toContain("level=3");
    expect(String(standingsCalls[0]?.[0])).toContain("season=2026");
    expect(result.current.data?.teams.map((team) => team.abbreviation)).toEqual(
      ["MIN", "NO"],
    );
    expect(savedTeams(2026)?.registry).toEqual(result.current.data);

    fetchMock.mockClear();
    const next = renderHook(() => useTeams(2026), { wrapper: queryWrapper() });
    await waitFor(() => expect(next.result.current.data).not.toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
