import { describe, expect, it } from "vitest";
import {
  PREGAME_WINDOW_MS,
  RECAP_WINDOW_MS,
  defaultGameId,
  deriveScheduleState,
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
  const early = makeTeamGame({
    gameId: "early",
    week: 4,
    kickoff: "2026-10-04T17:00:00.000Z",
    status: "final",
    result: { teamScore: 15, opponentScore: 10, outcome: "win" },
  });
  const late = makeTeamGame({ gameId: "late" });

  it("opens on the game the schedule leads with", () => {
    expect(
      defaultGameId(makeTeamSchedule([early, late]), KICKOFF_MS + 60_000),
    ).toBe("late");
  });

  it("opens on the latest game without a clock", () => {
    expect(defaultGameId(makeTeamSchedule([late, early]), null)).toBe("late");
  });
});

describe("deriveScheduleState", () => {
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

  it("leads with a live game", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, current, future]),
      KICKOFF_MS + 60_000,
    );
    expect(state).toEqual({ kind: "live", game: current });
  });

  it("leads with a pregame game and reports time to kickoff", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, current, future]),
      KICKOFF_MS - 90_000,
    );
    expect(state.kind).toBe("pregame");
    if (state.kind === "pregame") {
      expect(state.game.gameId).toBe("current");
      expect(state.msUntilKickoff).toBe(90_000);
    }
  });

  it("leads with a recap right after a game ends", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, currentFinal, future]),
      KICKOFF_MS + 4 * HOUR_MS,
    );
    expect(state).toEqual({ kind: "recap", game: currentFinal });
  });

  it("keeps the recap up to the edge of the window", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, currentFinal, future]),
      KICKOFF_MS + RECAP_WINDOW_MS,
    );
    expect(state.kind).toBe("recap");
  });

  it("falls through to upcoming once the recap window closes", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, currentFinal, future]),
      KICKOFF_MS + RECAP_WINDOW_MS + 1,
    );
    expect(state.kind).toBe("upcoming");
    if (state.kind === "upcoming") expect(state.game.gameId).toBe("future");
  });

  it("prefers a live game over a recap", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past, current]),
      KICKOFF_MS + 60_000,
    );
    expect(state).toEqual({ kind: "live", game: current });
  });

  it("recaps the most recent of several finished games", () => {
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
    const state = deriveScheduleState(
      makeTeamSchedule([thursday, sunday]),
      Date.parse("2026-10-12T00:00:00.000Z"),
    );
    expect(state).toEqual({ kind: "recap", game: sunday });
  });

  it("ignores a game flagged final with a future kickoff", () => {
    const badData = makeTeamGame({
      gameId: "bad",
      kickoff: "2026-12-25T18:00:00.000Z",
      status: "final",
      result: { teamScore: 1, opponentScore: 0, outcome: "win" },
    });
    const state = deriveScheduleState(
      makeTeamSchedule([badData]),
      Date.parse("2026-10-12T00:00:00.000Z"),
    );
    expect(state).toEqual({ kind: "offseason" });
  });

  it("picks the earliest upcoming game regardless of array order", () => {
    const later = makeTeamGame({
      gameId: "later",
      kickoff: "2026-12-06T21:25:00.000Z",
    });
    const state = deriveScheduleState(
      makeTeamSchedule([later, future]),
      Date.parse("2026-10-20T00:00:00.000Z"),
    );
    expect(state.kind).toBe("upcoming");
    if (state.kind === "upcoming") expect(state.game.gameId).toBe("future");
  });

  it("reports offseason when every game is long past", () => {
    const state = deriveScheduleState(
      makeTeamSchedule([past]),
      Date.parse("2027-02-01T00:00:00.000Z"),
    );
    expect(state).toEqual({ kind: "offseason" });
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
