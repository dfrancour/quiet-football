import { afterEach, describe, expect, it, vi } from "vitest";
import { savedWeek, saveWeek } from "~/lib/week-store";

const board = {
  season: { year: 2026, type: 2 },
  week: { number: 3 },
  events: [],
};

afterEach(() => vi.restoreAllMocks());

describe("week-store", () => {
  it("gives back a saved week, stripped to the fields read", () => {
    saveWeek(2026, 3, { ...board, leagues: [{ name: "NFL" }] });
    expect(savedWeek(2026, 3)).toEqual(board);
    expect(savedWeek(2026, 4)).toBeNull();
  });

  it("keeps one season only", () => {
    saveWeek(2025, 18, board);
    saveWeek(2026, 1, board);
    expect(savedWeek(2025, 18)).toBeNull();
    expect(savedWeek(2026, 1)).toEqual(board);
  });

  it("drops a copy it cannot read", () => {
    window.localStorage.setItem("scoreboard:2026:2", "{not json");
    window.localStorage.setItem(
      "scoreboard:2026:3",
      JSON.stringify({ format: 0, payload: board }),
    );
    expect(savedWeek(2026, 2)).toBeNull();
    expect(savedWeek(2026, 3)).toBeNull();
    expect(window.localStorage.getItem("scoreboard:2026:3")).toBeNull();
  });

  it("lets a full or blocked storage be", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => saveWeek(2026, 3, board)).not.toThrow();
    expect(savedWeek(2026, 3)).toBeNull();
  });
});
