import { afterEach, describe, expect, it, vi } from "vitest";
import { TEAMS } from "~/lib/test-utils/fixtures";
import { savedTeams, savedWeek, saveTeams, saveWeek } from "~/lib/week-store";

const board = {
  season: { year: 2026, type: 2 },
  week: { number: 3 },
  events: [],
};

const registry = { teams: [TEAMS.MIN, TEAMS.NO] };

const AT = Date.parse("2026-10-16T12:00:00Z");

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("week-store", () => {
  it("gives back a saved week, stripped to the fields read, with when it arrived", () => {
    saveWeek(2026, 3, { ...board, leagues: [{ name: "NFL" }] }, AT);
    expect(savedWeek(2026, 3)).toEqual({ payload: board, savedAt: AT });
    expect(savedWeek(2026, 4)).toBeNull();
  });

  it("keeps the registry the same way", () => {
    saveTeams(2026, registry, AT);
    expect(savedTeams(2026)).toEqual({ registry, savedAt: AT });
    expect(savedTeams(2025)).toBeNull();
  });

  it("keeps one season only", () => {
    saveWeek(2025, 18, board, AT);
    saveTeams(2025, registry, AT);
    saveWeek(2026, 1, board, AT);
    expect(savedWeek(2025, 18)).toBeNull();
    expect(savedWeek(2026, 1)?.payload).toEqual(board);
    saveTeams(2026, registry, AT);
    expect(savedTeams(2025)).toBeNull();
    expect(savedWeek(2026, 1)).not.toBeNull();
  });

  it("drops a copy it cannot read", () => {
    window.localStorage.setItem("scoreboard:2026:2", "{not json");
    window.localStorage.setItem(
      "scoreboard:2026:3",
      JSON.stringify({ format: 1, payload: board }),
    );
    expect(savedWeek(2026, 2)).toBeNull();
    expect(savedWeek(2026, 3)).toBeNull();
    expect(window.localStorage.getItem("scoreboard:2026:3")).toBeNull();
  });

  it("lets a full or blocked storage be", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => saveWeek(2026, 3, board, AT)).not.toThrow();
    expect(savedWeek(2026, 3)).toBeNull();
  });
});
