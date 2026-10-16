import { describe, expect, it } from "vitest";
import { makeTeamGame } from "~/lib/test-utils/fixtures";
import {
  catchUpThrough,
  getCaughtUp,
  maskedScore,
  recordsShownBefore,
  resultVisibility,
  spoilerSafeClock,
} from "~/lib/spoilers";

const won = makeTeamGame({
  status: "final",
  result: { teamScore: 15, opponentScore: 10, outcome: "win" },
});

describe("maskedScore", () => {
  it("hides a real score", () => {
    expect(maskedScore(21, false)).toBeNull();
  });

  it("reveals a score when asked", () => {
    expect(maskedScore(21, true)).toBe("21");
  });

  it("hides even a zero, which is still a result", () => {
    expect(maskedScore(0, false)).toBeNull();
    expect(maskedScore(0, true)).toBe("0");
  });

  it("distinguishes an unknown score from a hidden one", () => {
    expect(maskedScore(null, true)).toBe("--");
    expect(maskedScore(null, false)).toBeNull();
  });
});

describe("spoilerSafeClock", () => {
  const clock = (detail: string, period: number, completed = false) => ({
    detail,
    period,
    clock: detail.split(" - ")[0] ?? null,
    completed,
  });

  it("shows the clock through the first three quarters", () => {
    expect(spoilerSafeClock(clock("8:21 - 3rd", 3), false)).toBe("Q3 - 08:21");
  });

  it("never says overtime while the result is hidden", () => {
    expect(spoilerSafeClock(clock("10:00 - OT", 5), false)).toBe("Q4+");
    expect(spoilerSafeClock(clock("10:00 - OT", 5), true)).toBe("OT - 10:00");
  });

  it("reads the whole fourth quarter the same, so regulation ending shows nothing", () => {
    expect(spoilerSafeClock(clock("8:21 - 4th", 4), false)).toBe("Q4+");
    expect(spoilerSafeClock(clock("End of 4th Quarter", 4), false)).toBe("Q4+");
  });

  it("reads a finished game as Final, not Final/OT", () => {
    expect(spoilerSafeClock(clock("Final/OT", 5, true), false)).toBe("Final");
    expect(spoilerSafeClock(clock("Final/OT", 5, true), true)).toBe("Final/OT");
  });
});

describe("resultVisibility", () => {
  it("reports a played game as Final only, with scores hidden", () => {
    expect(resultVisibility(won, false)).toEqual({
      kind: "label",
      text: "Final",
    });
  });

  it("never leaks the win/loss letter while scores are hidden", () => {
    const lost = makeTeamGame({
      status: "final",
      result: { teamScore: 10, opponentScore: 20, outcome: "loss" },
    });
    expect(resultVisibility(lost, false)).toEqual({
      kind: "label",
      text: "Final",
    });
  });

  it("gives the full result when asked", () => {
    expect(resultVisibility(won, true)).toEqual({
      kind: "result",
      teamScore: 15,
      opponentScore: 10,
      outcome: "win",
    });
  });

  it("treats an unplayed game as upcoming regardless of the toggle", () => {
    const scheduled = makeTeamGame();
    expect(resultVisibility(scheduled, true)).toEqual({ kind: "upcoming" });
    expect(resultVisibility(scheduled, false)).toEqual({ kind: "upcoming" });
  });

  it("does not reveal an in-progress game through this cell", () => {
    const live = makeTeamGame({ status: "in_progress" });
    expect(resultVisibility(live, true)).toEqual({ kind: "upcoming" });
  });

  it("labels a final game that has no recorded score", () => {
    expect(resultVisibility(makeTeamGame({ status: "final" }), true)).toEqual({
      kind: "label",
      text: "Final",
    });
  });

  it("surfaces postponed and canceled games", () => {
    expect(
      resultVisibility(makeTeamGame({ status: "postponed" }), true),
    ).toEqual({ kind: "label", text: "Postponed" });
    expect(
      resultVisibility(makeTeamGame({ status: "canceled" }), true),
    ).toEqual({ kind: "label", text: "Canceled" });
  });
});

describe("catchUpThrough", () => {
  it("keeps each season's week, and lasts", () => {
    catchUpThrough(2025, 22);
    catchUpThrough(2026, 7);
    expect(getCaughtUp()).toEqual({ "2025": 22, "2026": 7 });
    expect(JSON.parse(window.localStorage.getItem("caught-up") ?? "")).toEqual({
      "2025": 22,
      "2026": 7,
    });
  });

  it("forgets a season caught up through nothing, and only that one", () => {
    catchUpThrough(2025, 22);
    catchUpThrough(2026, 7);
    catchUpThrough(2026, 0);
    expect(getCaughtUp()).toEqual({ "2025": 22 });
  });

  it("reads a missing or unreadable value as caught up through nothing", () => {
    expect(getCaughtUp()).toEqual({});
    window.localStorage.setItem("caught-up", '{"2026":-1}');
    expect(getCaughtUp()).toEqual({});
  });
});

describe("recordsShownBefore", () => {
  it("shows a week's records going in once every week before is", () => {
    expect(recordsShownBefore(1, 0, 18)).toBe(true);
    expect(recordsShownBefore(8, 7, 18)).toBe(true);
    expect(recordsShownBefore(9, 7, 18)).toBe(false);
  });

  it("shows a playoff game's once the regular season is", () => {
    expect(recordsShownBefore(20, 18, 18)).toBe(true);
    expect(recordsShownBefore(19, 17, 18)).toBe(false);
  });
});
