import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSpoilers, type CaughtUpState } from "~/hooks/useSpoilers";
import { catchUpThrough, getCaughtUp } from "~/lib/spoilers";
import { makeTeamGame } from "~/lib/test-utils/fixtures";
import { recordWatchProgress } from "~/lib/watch-progress";

const state: CaughtUpState = {
  season: 2026,
  totalWeeks: 18,
  settledThrough: 19,
  currentWeek: 20,
};

function through(week: number) {
  catchUpThrough(2026, week);
  return renderHook(() => useSpoilers(state)).result;
}

describe("useSpoilers", () => {
  it("shows every game through the week caught up through, and none after", () => {
    const result = through(7);
    expect(result.current.through).toBe(7);
    expect(result.current.isShown({ gameId: "a", week: 7 })).toBe(true);
    expect(result.current.isShown({ gameId: "b", week: 8 })).toBe(false);
  });

  it("shows a game seen to the end past the week caught up through", () => {
    recordWatchProgress("b", { playId: null, finished: true });
    recordWatchProgress("c", { playId: "p1", finished: false });
    const result = through(7);
    expect(result.current.isShown({ gameId: "b", week: 8 })).toBe(true);
    expect(result.current.isShown({ gameId: "c", week: 8 })).toBe(false);
  });

  it("opens a playoff round once caught up through the one before", () => {
    const gate = [
      { gameId: "w18", week: 18 },
      { gameId: "wc", week: 19 },
    ];
    expect(through(18).current.isOpen(gate)).toBe(false);
    expect(through(19).current.isOpen(gate)).toBe(true);
  });

  it("counts a team's record only through the week caught up through", () => {
    const won = (gameId: string, week: number) =>
      makeTeamGame({
        gameId,
        week,
        status: "final",
        result: { teamScore: 20, opponentScore: 10, outcome: "win" },
      });
    const games = [won("a", 6), won("b", 7), won("c", 8)];
    expect(through(0).current.recordThrough(games)).toBeNull();
    expect(through(7).current.recordThrough(games)).toEqual({
      wins: 2,
      losses: 0,
      ties: 0,
    });
  });

  it("catches up through a week of its season only, and the page follows", () => {
    catchUpThrough(2025, 22);
    const result = through(7);
    act(() => result.current.catchUp(12));
    expect(getCaughtUp()).toEqual({ "2025": 22, "2026": 12 });
    expect(result.current.through).toBe(12);
  });

  it("hides everything in its season again, and only there", () => {
    catchUpThrough(2025, 22);
    const result = through(7);
    act(() => result.current.catchUp(0));
    expect(getCaughtUp()).toEqual({ "2025": 22 });
    expect(result.current.through).toBe(0);
  });
});
