import { describe, expect, it } from "vitest";
import { buildTeamSchedule } from "~/lib/team-view";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

describe("buildTeamSchedule", () => {
  it("derives the home side of a game", () => {
    const game = makeSeasonGame({
      home: { teamId: TEAMS.MIN.teamId, score: 15 },
      away: { teamId: TEAMS.MIA.teamId, score: 10 },
      status: "final",
    });
    const schedule = buildTeamSchedule(
      makeSeason([game]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );

    expect(schedule.games).toHaveLength(1);
    const derived = schedule.games[0]!;
    expect(derived.homeAway).toBe("home");
    expect(derived.opponent.abbreviation).toBe("MIA");
    expect(derived.result).toEqual({
      teamScore: 15,
      opponentScore: 10,
      outcome: "win",
    });
  });

  it("derives the away side of the same game as a mirror image", () => {
    const game = makeSeasonGame({
      home: { teamId: TEAMS.MIN.teamId, score: 15 },
      away: { teamId: TEAMS.MIA.teamId, score: 10 },
      status: "final",
    });
    const miami = buildTeamSchedule(
      makeSeason([game]),
      REGISTRY,
      TEAMS.MIA.teamId,
    );

    const derived = miami.games[0]!;
    expect(derived.homeAway).toBe("away");
    expect(derived.opponent.abbreviation).toBe("MIN");
    expect(derived.result).toEqual({
      teamScore: 10,
      opponentScore: 15,
      outcome: "loss",
    });
  });

  it("records a tie", () => {
    const game = makeSeasonGame({
      home: { teamId: TEAMS.MIN.teamId, score: 17 },
      away: { teamId: TEAMS.GB.teamId, score: 17 },
      status: "final",
    });
    const schedule = buildTeamSchedule(
      makeSeason([game]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.games[0]!.result?.outcome).toBe("tie");
  });

  it("leaves the result null until a game is final", () => {
    const game = makeSeasonGame({
      home: { teamId: TEAMS.MIN.teamId, score: 7 },
      away: { teamId: TEAMS.GB.teamId, score: 3 },
      status: "in_progress",
    });
    const schedule = buildTeamSchedule(
      makeSeason([game]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.games[0]!.result).toBeNull();
  });

  it("excludes games the team is not in", () => {
    const other = makeSeasonGame({
      gameId: "other",
      home: { teamId: TEAMS.GB.teamId, score: null },
      away: { teamId: TEAMS.CHI.teamId, score: null },
    });
    const schedule = buildTeamSchedule(
      makeSeason([other]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.games).toEqual([]);
  });

  it("orders games by kickoff", () => {
    const later = makeSeasonGame({
      gameId: "later",
      week: 7,
      kickoff: "2026-10-25T17:00:00.000Z",
    });
    const earlier = makeSeasonGame({
      gameId: "earlier",
      week: 1,
      kickoff: "2026-09-13T20:25:00.000Z",
    });
    const schedule = buildTeamSchedule(
      makeSeason([later, earlier]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.games.map((g) => g.gameId)).toEqual(["earlier", "later"]);
  });

  it("derives bye weeks from the weeks with no game", () => {
    const games = [1, 2, 4].map((week) =>
      makeSeasonGame({ gameId: `w${week}`, week }),
    );
    const schedule = buildTeamSchedule(
      makeSeason(games, { totalWeeks: 4 }),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.byeWeeks).toEqual([3]);
  });

  it("stands in a placeholder for an opponent missing from the registry", () => {
    const game = makeSeasonGame({
      home: { teamId: TEAMS.MIN.teamId, score: null },
      away: { teamId: "999", score: null },
    });
    const schedule = buildTeamSchedule(
      makeSeason([game]),
      REGISTRY,
      TEAMS.MIN.teamId,
    );
    expect(schedule.games[0]!.opponent.abbreviation).toBe("???");
  });
});

describe("records before a game", () => {
  const at = (week: number) =>
    `2026-10-${String(week).padStart(2, "0")}T17:00:00.000Z`;

  it("counts each side's finals that kicked off earlier, from the league file", () => {
    const season = makeSeason([
      // MIA's game without MIN still counts toward MIA's record.
      makeSeasonGame({
        gameId: "1",
        kickoff: at(1),
        status: "final",
        home: { teamId: TEAMS.MIA.teamId, score: 20 },
        away: { teamId: TEAMS.NE.teamId, score: 10 },
      }),
      makeSeasonGame({
        gameId: "2",
        kickoff: at(2),
        status: "final",
        home: { teamId: TEAMS.MIN.teamId, score: 7 },
        away: { teamId: TEAMS.GB.teamId, score: 7 },
      }),
      makeSeasonGame({
        gameId: "3",
        kickoff: at(3),
        status: "final",
        home: { teamId: TEAMS.MIN.teamId, score: 24 },
        away: { teamId: TEAMS.MIA.teamId, score: 17 },
      }),
    ]);

    const [tie, meeting] = buildTeamSchedule(
      season,
      REGISTRY,
      TEAMS.MIN.teamId,
    ).games;

    expect(tie?.recordsBefore.team).toEqual({ wins: 0, losses: 0, ties: 0 });
    // The meeting's own result is not part of either record going into it.
    expect(meeting?.recordsBefore).toEqual({
      team: { wins: 0, losses: 0, ties: 1 },
      opponent: { wins: 1, losses: 0, ties: 0 },
    });
  });

  it("orients the records to the team named by abbreviation", () => {
    const season = makeSeason([
      makeSeasonGame({
        gameId: "1",
        kickoff: at(1),
        status: "final",
        home: { teamId: TEAMS.GB.teamId, score: 30 },
        away: { teamId: TEAMS.CHI.teamId, score: 3 },
      }),
      makeSeasonGame({
        gameId: "2",
        kickoff: at(2),
        home: { teamId: TEAMS.MIN.teamId, score: null },
        away: { teamId: TEAMS.GB.teamId, score: null },
      }),
    ]);
    const game = buildTeamSchedule(season, REGISTRY, TEAMS.GB.teamId).games[1];
    expect(game?.recordsBefore).toEqual({
      team: { wins: 1, losses: 0, ties: 0 },
      opponent: { wins: 0, losses: 0, ties: 0 },
    });
  });
});

describe("playoff games", () => {
  const season = makeSeason([
    makeSeasonGame({
      gameId: "1",
      week: 18,
      kickoff: "2027-01-03T18:00:00.000Z",
      status: "final",
      home: { teamId: TEAMS.MIN.teamId, score: 27 },
      away: { teamId: TEAMS.GB.teamId, score: 20 },
    }),
    makeSeasonGame({
      gameId: "2",
      week: 19,
      kickoff: "2027-01-10T18:00:00.000Z",
      status: "final",
      home: { teamId: TEAMS.MIN.teamId, score: 31 },
      away: { teamId: TEAMS.GB.teamId, score: 17 },
    }),
    makeSeasonGame({
      gameId: "3",
      week: 20,
      kickoff: "2027-01-17T18:00:00.000Z",
      home: { teamId: TEAMS.MIN.teamId, score: null },
      away: { teamId: TEAMS.NO.teamId, score: null },
    }),
  ]);

  it("are named by round and are not bye weeks", () => {
    const schedule = buildTeamSchedule(season, REGISTRY, TEAMS.MIN.teamId);
    expect(schedule.games.map((game) => game.round)).toEqual([
      null,
      "wild-card",
      "divisional",
    ]);
    expect(schedule.byeWeeks).not.toContain(19);
  });

  it("go into each game with the regular-season record", () => {
    const divisional = buildTeamSchedule(season, REGISTRY, TEAMS.MIN.teamId)
      .games[2];
    expect(divisional?.recordsBefore.team).toEqual({
      wins: 1,
      losses: 0,
      ties: 0,
    });
  });
});
