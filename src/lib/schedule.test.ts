import { describe, expect, it } from "vitest";
import {
  JUST_PLAYED_MS,
  PREGAME_WINDOW_MS,
  defaultGameId,
  formatAge,
  formatCountdown,
  formatRecord,
  gamePhase,
  matchupLabel,
  teamRecord,
} from "~/lib/schedule";
import {
  TEAMS,
  makeTeamGame,
  makeTeamSchedule,
} from "~/lib/test-utils/fixtures";
import { type TeamGame } from "~/lib/team-view";

const KICKOFF_MS = Date.parse("2026-10-11T17:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

describe("gamePhase", () => {
  it("is upcoming well before kickoff", () => {
    expect(
      gamePhase(makeTeamGame(), KICKOFF_MS - PREGAME_WINDOW_MS - 60_000),
    ).toBe("upcoming");
  });

  it("switches to pregame inside the pregame window", () => {
    expect(gamePhase(makeTeamGame(), KICKOFF_MS - 60_000)).toBe("pregame");
  });

  it("is live from kickoff however long the game runs", () => {
    expect(gamePhase(makeTeamGame(), KICKOFF_MS)).toBe("live");
    expect(gamePhase(makeTeamGame(), KICKOFF_MS + 8 * HOUR_MS)).toBe("live");
  });

  it("stays live until the store calls it final", () => {
    expect(
      gamePhase(
        makeTeamGame({ status: "in_progress" }),
        KICKOFF_MS + 8 * HOUR_MS,
      ),
    ).toBe("live");
  });

  it("trusts a recorded final even inside the live window", () => {
    const game = makeTeamGame({
      status: "final",
      result: { teamScore: 23, opponentScore: 16, outcome: "win" },
    });
    expect(gamePhase(game, KICKOFF_MS + 60_000)).toBe("final");
  });

  it("surfaces postponed and canceled games directly", () => {
    expect(gamePhase(makeTeamGame({ status: "postponed" }), KICKOFF_MS)).toBe(
      "postponed",
    );
    expect(gamePhase(makeTeamGame({ status: "canceled" }), KICKOFF_MS)).toBe(
      "canceled",
    );
  });

  it("treats an unparseable kickoff as upcoming rather than throwing", () => {
    expect(gamePhase(makeTeamGame({ kickoff: "not-a-date" }), KICKOFF_MS)).toBe(
      "upcoming",
    );
  });
});

describe("defaultGameId", () => {
  const past = makeTeamGame({
    gameId: "past",
    week: 4,
    kickoff: "2026-10-04T20:05:00.000Z",
    status: "final",
    opponent: TEAMS.MIA,
    result: { teamScore: 15, opponentScore: 10, outcome: "win" },
  });
  const current = makeTeamGame({ gameId: "current" });
  const currentFinal = makeTeamGame({
    gameId: "current",
    status: "final",
    result: { teamScore: 23, opponentScore: 16, outcome: "win" },
  });
  const future = makeTeamGame({
    gameId: "future",
    week: 7,
    kickoff: "2026-10-25T17:00:00.000Z",
  });
  const opensOn = (games: TeamGame[], now: number | null) =>
    defaultGameId(makeTeamSchedule(games), now);

  it("opens on a live game", () => {
    expect(opensOn([past, current, future], KICKOFF_MS + 60_000)).toBe(
      "current",
    );
    expect(opensOn([past, current], KICKOFF_MS + 60_000)).toBe("current");
  });

  it("opens on a game about to kick off", () => {
    expect(opensOn([past, current, future], KICKOFF_MS - 90_000)).toBe(
      "current",
    );
  });

  it("opens on a game just played, up to the edge of the window", () => {
    const schedule = [past, currentFinal, future];
    expect(opensOn(schedule, KICKOFF_MS + 4 * HOUR_MS)).toBe("current");
    expect(opensOn(schedule, KICKOFF_MS + JUST_PLAYED_MS)).toBe("current");
    // Then the next game.
    expect(opensOn(schedule, KICKOFF_MS + JUST_PLAYED_MS + 1)).toBe("future");
  });

  it("opens on the most recent of several finished games", () => {
    const thursday = makeTeamGame({
      gameId: "thursday",
      week: 4,
      kickoff: "2026-10-08T20:05:00.000Z",
      status: "final",
      result: { teamScore: 20, opponentScore: 17, outcome: "win" },
    });
    const sunday = makeTeamGame({
      gameId: "sunday",
      status: "final",
      result: { teamScore: 23, opponentScore: 16, outcome: "win" },
    });
    expect(
      opensOn([thursday, sunday], Date.parse("2026-10-12T00:00:00.000Z")),
    ).toBe("sunday");
  });

  it("opens on the earliest game to come, whatever the order", () => {
    const later = makeTeamGame({
      gameId: "later",
      kickoff: "2026-12-06T21:25:00.000Z",
    });
    expect(
      opensOn([later, future], Date.parse("2026-10-20T00:00:00.000Z")),
    ).toBe("future");
  });

  it("opens on the latest game out of season, or without a clock", () => {
    expect(opensOn([past], Date.parse("2027-02-01T00:00:00.000Z"))).toBe(
      "past",
    );
    expect(opensOn([current, past], null)).toBe("current");
    // A game flagged final before its kickoff is no game just played.
    const badData = makeTeamGame({
      gameId: "bad",
      kickoff: "2026-12-25T18:00:00.000Z",
      status: "final",
      result: { teamScore: 1, opponentScore: 0, outcome: "win" },
    });
    expect(opensOn([past, badData], KICKOFF_MS)).toBe("bad");
  });
});

describe("teamRecord", () => {
  it("counts only completed games", () => {
    const games = [
      makeTeamGame({
        status: "final",
        result: { teamScore: 39, opponentScore: 22, outcome: "win" },
      }),
      makeTeamGame({
        status: "final",
        result: { teamScore: 9, opponentScore: 3, outcome: "win" },
      }),
      makeTeamGame({
        status: "final",
        result: { teamScore: 10, opponentScore: 20, outcome: "loss" },
      }),
      makeTeamGame({
        status: "final",
        result: { teamScore: 17, opponentScore: 17, outcome: "tie" },
      }),
      makeTeamGame(),
      makeTeamGame({ status: "in_progress" }),
    ];
    expect(teamRecord(games)).toEqual({ wins: 2, losses: 1, ties: 1 });
  });

  it("ignores a final game with no recorded result", () => {
    expect(teamRecord([makeTeamGame({ status: "final" })])).toEqual({
      wins: 0,
      losses: 0,
      ties: 0,
    });
  });
});

describe("formatRecord", () => {
  it("omits ties when there are none", () => {
    expect(formatRecord({ wins: 4, losses: 1, ties: 0 })).toBe("4-1");
  });

  it("includes ties when present", () => {
    expect(formatRecord({ wins: 4, losses: 1, ties: 1 })).toBe("4-1-1");
  });
});

describe("matchupLabel", () => {
  it("distinguishes home from road games", () => {
    expect(matchupLabel(makeTeamGame({ homeAway: "home" }))).toBe("vs NO");
    expect(matchupLabel(makeTeamGame({ homeAway: "away" }))).toBe("at NO");
  });
});

describe("formatCountdown", () => {
  it("coarsens to the largest useful unit", () => {
    expect(formatCountdown(3 * 24 * 3_600_000 + 4 * 3_600_000)).toBe("3d 4h");
    expect(formatCountdown(2 * 3_600_000 + 30 * 60_000)).toBe("2h 30m");
    expect(formatCountdown(45 * 60_000)).toBe("45m");
  });

  it("returns null once kickoff has passed", () => {
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(-1_000)).toBeNull();
  });
});

describe("formatAge", () => {
  it("rounds down to seconds, then minutes", () => {
    expect(formatAge(2_000)).toBe("just now");
    expect(formatAge(12_900)).toBe("12s ago");
    expect(formatAge(185_000)).toBe("3m ago");
  });

  it("reads a timestamp slightly ahead of the local clock as fresh", () => {
    expect(formatAge(-3_000)).toBe("just now");
  });
});
