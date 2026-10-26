import { describe, expect, it } from "vitest";
import {
  readWeek,
  seasonFromWeeks,
  seasonGamesFromScoreboard,
  weekActivity,
} from "~/lib/season-sync";
import { GAME_ID, TEAMS, makeSeasonGame } from "~/lib/test-utils/fixtures";

/** MIN at NO in week 5, as ESPN's scoreboard reports it. */
function scoreboard(status: unknown, scores: [string, string] = ["23", "13"]) {
  return {
    season: { year: 2026, type: 2 },
    week: { number: 5 },
    events: [
      {
        id: GAME_ID,
        date: "2026-10-11T17:00Z",
        week: { number: 5 },
        competitions: [
          {
            status,
            neutralSite: false,
            venue: {
              fullName: "Caesars Superdome",
              address: { city: "New Orleans", state: "LA" },
            },
            broadcasts: [{ names: ["FOX"] }],
            competitors: [
              {
                homeAway: "home",
                team: { id: TEAMS.NO.teamId },
                score: scores[1],
                linescores: [
                  { period: 2, value: 10 },
                  { period: 1, value: 0 },
                  { period: 3, value: 0 },
                  { period: 4, value: 3 },
                ],
              },
              {
                homeAway: "away",
                team: { id: TEAMS.MIN.teamId },
                score: scores[0],
                linescores: [
                  { period: 1, value: 7 },
                  { period: 2, value: 3 },
                  { period: 3, value: 6 },
                  { period: 4, value: 7 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const FINAL = {
  type: { name: "STATUS_FINAL", state: "post", completed: true },
};

describe("seasonGamesFromScoreboard", () => {
  it("reads a finished game as stored, quarters in order", () => {
    const board = seasonGamesFromScoreboard(scoreboard(FINAL));
    expect(board.season).toBe(2026);
    expect(board.seasonType).toBe(2);
    expect(board.games).toEqual([
      {
        gameId: GAME_ID,
        week: 5,
        kickoff: "2026-10-11T17:00Z",
        status: "final",
        neutralSite: false,
        broadcast: "FOX",
        home: { teamId: TEAMS.NO.teamId, score: 13, periods: [0, 10, 0, 3] },
        away: { teamId: TEAMS.MIN.teamId, score: 23, periods: [7, 3, 6, 7] },
      },
    ]);
  });

  it("counts halftime as under way", () => {
    const board = seasonGamesFromScoreboard(
      scoreboard({ type: { name: "STATUS_HALFTIME", state: "in" } }),
    );
    expect(board.games[0]?.status).toBe("in_progress");
  });

  it("files each playoff round as a week after the regular season", () => {
    const playoffs = (week: number, headline: string) => {
      const board = scoreboard(FINAL);
      return {
        ...board,
        season: { year: 2026, type: 3 },
        week: { number: week },
        events: board.events.map((event) => ({
          ...event,
          week: { number: week },
          competitions: event.competitions.map((competition) => ({
            ...competition,
            notes: [{ headline }],
          })),
        })),
      };
    };
    const weekOf = (payload: unknown) =>
      seasonGamesFromScoreboard(payload).games.map((game) => game.week);

    expect(weekOf(playoffs(1, "NFC Wild Card Playoffs"))).toEqual([19]);
    expect(weekOf(playoffs(3, "NFC Championship"))).toEqual([21]);
    expect(weekOf(playoffs(4, "Pro Bowl Games"))).toEqual([]);
    expect(weekOf(playoffs(5, "Super Bowl LXI"))).toEqual([22]);
  });

  it("drops a playoff game whose teams are not yet known", () => {
    const board = scoreboard({ type: { name: "STATUS_SCHEDULED" } });
    const tbd = {
      ...board,
      season: { year: 2026, type: 3 },
      events: board.events.map((event) => ({
        ...event,
        week: { number: 2 },
        competitions: event.competitions.map((competition) => ({
          ...competition,
          competitors: competition.competitors.map((competitor, index) => ({
            ...competitor,
            team: { id: String(-1 - index) },
          })),
        })),
      })),
    };
    expect(seasonGamesFromScoreboard(tbd).games).toEqual([]);
  });

  it("reads a malformed payload as no games", () => {
    expect(seasonGamesFromScoreboard({ events: "nope" }).games).toEqual([]);
  });
});

describe("readWeek", () => {
  it("files a regular-season game under the week it was fetched for", () => {
    const week = readWeek(2026, 7, scoreboard(FINAL));
    expect(week.games.map((game) => game.week)).toEqual([7]);
    expect(week.board.map((game) => game.gameId)).toEqual([GAME_ID]);
  });

  it("refuses a payload that is not a scoreboard", () => {
    expect(() => readWeek(2026, 7, { events: "nope" })).toThrow(/unreadable/);
  });
});

describe("seasonFromWeeks", () => {
  it("orders every week's games by kickoff", () => {
    const later = {
      ...scoreboard(FINAL),
      events: scoreboard(FINAL).events.map((event) => ({
        ...event,
        id: "401872999",
        date: "2026-10-18T17:00Z",
      })),
    };
    const season = seasonFromWeeks(2026, [
      readWeek(2026, 6, later),
      readWeek(2026, 5, scoreboard(FINAL)),
    ]);
    expect(season.totalWeeks).toBe(18);
    expect(season.games.map((game) => [game.gameId, game.week])).toEqual([
      [GAME_ID, 5],
      ["401872999", 6],
    ]);
  });
});

describe("weekActivity", () => {
  const kickoff = Date.parse("2026-10-11T17:00:00.000Z");

  it("is live while a game has kicked off and is not settled", () => {
    expect(
      weekActivity(
        [makeSeasonGame({ status: "final" }), makeSeasonGame()],
        kickoff + 60_000,
      ),
    ).toBe("live");
    expect(
      weekActivity([makeSeasonGame({ status: "in_progress" })], kickoff),
    ).toBe("live");
  });

  it("is settled once every game is final or canceled", () => {
    expect(
      weekActivity(
        [
          makeSeasonGame({ status: "final" }),
          makeSeasonGame({ status: "canceled" }),
        ],
        kickoff + 60_000,
      ),
    ).toBe("settled");
  });

  it("is ahead before kickoff, with a postponed game, and before a round is set", () => {
    expect(weekActivity([makeSeasonGame()], kickoff - 60_000)).toBe("ahead");
    expect(
      weekActivity(
        [
          makeSeasonGame({ status: "final" }),
          makeSeasonGame({ status: "postponed" }),
        ],
        kickoff - 60_000,
      ),
    ).toBe("ahead");
    expect(weekActivity([], kickoff)).toBe("ahead");
  });
});
