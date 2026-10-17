import { describe, expect, it } from "vitest";
import {
  buildLeagueGames,
  currentWeek,
  settledThrough,
  weekInProgress,
} from "~/lib/week";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

const SUNDAY = Date.parse("2026-10-11T17:00:00.000Z");
const MONDAY = Date.parse("2026-10-13T00:15:00.000Z");
const THURSDAY = Date.parse("2026-10-16T00:15:00.000Z");
const LATER_MS = 5 * 60 * 60 * 1000;

const season = makeSeason([
  makeSeasonGame({
    gameId: "sun",
    week: 5,
    kickoff: new Date(SUNDAY).toISOString(),
    home: { teamId: TEAMS.NO.teamId, score: null },
    away: { teamId: TEAMS.MIN.teamId, score: null },
  }),
  makeSeasonGame({
    gameId: "mon",
    week: 5,
    kickoff: new Date(MONDAY).toISOString(),
    home: { teamId: TEAMS.NYJ.teamId, score: null },
    away: { teamId: TEAMS.MIA.teamId, score: null },
  }),
  makeSeasonGame({
    gameId: "thu",
    week: 6,
    kickoff: new Date(THURSDAY).toISOString(),
    home: { teamId: TEAMS.GB.teamId, score: null },
    away: { teamId: TEAMS.CHI.teamId, score: null },
  }),
]);

/** The season with these games final. */
function settled(...gameIds: string[]) {
  return {
    ...season,
    games: season.games.map((game) =>
      gameIds.includes(game.gameId)
        ? { ...game, status: "final" as const }
        : game,
    ),
  };
}

describe("currentWeek", () => {
  it("is the first game's week before the season starts", () => {
    expect(currentWeek(season, SUNDAY - 30 * 24 * 3_600_000)).toBe(5);
  });

  it("stays on a week while its Monday game is still to come", () => {
    expect(currentWeek(settled("sun"), SUNDAY + LATER_MS)).toBe(5);
  });

  it("stays on a week while its last game runs long", () => {
    expect(currentWeek(settled("sun"), MONDAY + LATER_MS)).toBe(5);
  });

  it("moves on once the store calls the week's last game final", () => {
    expect(currentWeek(settled("sun", "mon"), MONDAY + LATER_MS)).toBe(6);
  });

  it("stays on the last week once the season is over", () => {
    expect(currentWeek(settled("sun", "mon", "thu"), THURSDAY + LATER_MS)).toBe(
      6,
    );
  });
});

describe("settledThrough", () => {
  it("stops before the first week with a game still to settle", () => {
    expect(settledThrough(season)).toBe(4);
    expect(settledThrough(settled("sun"))).toBe(4);
    expect(settledThrough(settled("sun", "mon"))).toBe(5);
  });

  it("is the last week once every game is settled", () => {
    expect(settledThrough(settled("sun", "mon", "thu"))).toBe(6);
  });

  it("counts a canceled game as settled and a postponed one as not", () => {
    const withStatus = (status: "canceled" | "postponed") => ({
      ...settled("sun", "thu"),
      games: settled("sun", "thu").games.map((game) =>
        game.gameId === "mon" ? { ...game, status } : game,
      ),
    });
    expect(settledThrough(withStatus("canceled"))).toBe(6);
    expect(settledThrough(withStatus("postponed"))).toBe(4);
  });
});

describe("weekInProgress", () => {
  it("is the week after the settled ones once a game in it is over", () => {
    expect(weekInProgress(season)).toBeNull();
    expect(weekInProgress(settled("sun"))).toEqual({
      week: 5,
      finalGameIds: ["sun"],
    });
    // Week 5 settled, nothing in week 6 over yet.
    expect(weekInProgress(settled("sun", "mon"))).toBeNull();
  });

  it("names only the games that are final, not canceled ones", () => {
    const withCanceled = {
      ...settled("sun"),
      games: settled("sun").games.map((game) =>
        game.gameId === "mon" ? { ...game, status: "canceled" as const } : game,
      ),
    };
    // Week 5 is then settled; week 6 has nothing over yet.
    expect(weekInProgress(withCanceled)).toBeNull();
  });

  it("is null once every game is settled", () => {
    expect(weekInProgress(settled("sun", "mon", "thu"))).toBeNull();
  });
});

describe("buildLeagueGames", () => {
  it("lists the season in kickoff order with both teams resolved", () => {
    const games = buildLeagueGames(season, REGISTRY);
    expect(games.map((game) => [game.gameId, game.week])).toEqual([
      ["sun", 5],
      ["mon", 5],
      ["thu", 6],
    ]);
    expect(games[0]?.away.team.abbreviation).toBe("MIN");
    expect(games[0]?.home.team.abbreviation).toBe("NO");
  });
});
