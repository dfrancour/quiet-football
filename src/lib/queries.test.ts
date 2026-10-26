import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreConfig } from "~/lib/config";
import {
  weekPollMs,
  weekQuery,
  weekStaleMs,
  type LoadedBoard,
} from "~/lib/queries";
import { readWeek } from "~/lib/season-sync";
import { GAME_ID, TEAMS } from "~/lib/test-utils/fixtures";
import { makeQueryClient, stubFetch } from "~/lib/test-utils/query";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const HOUR = 60 * 60_000;
const FINAL = { name: "STATUS_FINAL", state: "post" };
const SCHEDULED = { name: "STATUS_SCHEDULED", state: "pre" };
const IN_PROGRESS = { name: "STATUS_IN_PROGRESS", state: "in" };

/** A week's scoreboard with one game between MIN and NO. */
function scoreboard(
  season: number,
  week: number,
  status: { name: string; state: string },
  date = "2026-10-11T17:00:00Z",
) {
  return {
    season: { year: season, type: 2 },
    week: { number: week },
    events: [
      {
        id: `${GAME_ID}${week}`,
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
      },
    ],
  };
}

function board(payload: unknown, fetchedAt: number): LoadedBoard {
  return { ...readWeek(2026, 7, payload), fetchedAt, waiting: false };
}

/** Week 7 as its query holds it, landed in the cache at `updatedAt`. */
function week(data: LoadedBoard, updatedAt = NOW) {
  const state = {
    data,
    dataUpdatedAt: updatedAt,
    fetchFailureCount: 0,
    fetchFailureReason: null,
  };
  return {
    /** Whether it is stale this long after it landed, as Query reckons. */
    staleAfter: (ms: number) => ms >= weekStaleMs(state, updatedAt + ms),
    pollMs: () => weekPollMs(state, NOW),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("weekQuery", () => {
  it("trusts a week ahead for its full time from when it arrived", () => {
    const later = new Date(NOW + 48 * HOUR).toISOString();
    const ahead = scoreboard(2026, 7, SCHEDULED, later);

    const fetched = week(board(ahead, NOW));
    expect(fetched.staleAfter(scoreConfig.aheadStaleMs - 1000)).toBe(false);
    expect(fetched.staleAfter(scoreConfig.aheadStaleMs)).toBe(true);
    // Saved an hour before by an earlier visit: an hour less.
    const saved = week(board(ahead, NOW - HOUR));
    expect(saved.staleAfter(scoreConfig.aheadStaleMs - HOUR - 1000)).toBe(
      false,
    );
    expect(saved.staleAfter(scoreConfig.aheadStaleMs - HOUR)).toBe(true);
  });

  it("asks for a week ahead again as its next game kicks off, or its trust runs out", () => {
    const kickingOffIn = (ms: number) =>
      week(
        board(
          scoreboard(2026, 7, SCHEDULED, new Date(NOW + ms).toISOString()),
          NOW,
        ),
      ).pollMs();

    expect(kickingOffIn(2 * HOUR)).toBe(2 * HOUR);
    expect(kickingOffIn(48 * HOUR)).toBe(scoreConfig.aheadStaleMs);
    // No sooner than a live week is polled.
    expect(kickingOffIn(1000)).toBe(scoreConfig.livePollMs);
  });

  it("polls a live week and leaves a settled one", () => {
    const live = week(board(scoreboard(2026, 7, IN_PROGRESS), NOW));
    expect(live.pollMs()).toBe(scoreConfig.livePollMs);
    expect(live.staleAfter(0)).toBe(true);
    const settled = week(board(scoreboard(2026, 7, FINAL), NOW));
    expect(settled.pollMs()).toBe(false);
    expect(settled.staleAfter(365 * 24 * HOUR)).toBe(false);
  });

  it("holds a round until the week before settles, then asks ESPN for it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2027-01-03T20:00:00Z"));
    let weekEighteen = IN_PROGRESS;
    const fetchMock = stubFetch((url) => {
      const query = new URL(url).searchParams;
      return query.get("seasontype") === "3"
        ? { events: [] }
        : scoreboard(2026, 18, weekEighteen, "2027-01-03T18:00:00Z");
    });
    const client = makeQueryClient();
    const roundAsked = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("seasontype=3"),
      ).length;

    await client.fetchQuery(weekQuery(2026, 18));
    const waiting = await client.fetchQuery(weekQuery(2026, 19));
    expect(waiting.waiting).toBe(true);
    expect(week(waiting).pollMs()).toBe(scoreConfig.livePollMs);
    // Waiting again is read from the cache, and is the same board.
    expect(
      await client.fetchQuery({ ...weekQuery(2026, 19), staleTime: 0 }),
    ).toBe(waiting);
    expect(roundAsked()).toBe(0);

    weekEighteen = FINAL;
    await client.fetchQuery({ ...weekQuery(2026, 18), staleTime: 0 });
    const set = await client.fetchQuery({
      ...weekQuery(2026, 19),
      staleTime: 0,
    });
    expect(set.waiting).toBe(false);
    expect(roundAsked()).toBe(1);
  });
});
