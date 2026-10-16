import { describe, expect, it } from "vitest";
import {
  currentSeason,
  parseWeekParam,
  playoffRound,
  weekName,
  weekParam,
} from "~/lib/season-calendar";

describe("currentSeason", () => {
  it("is the year the season kicked off in", () => {
    expect(currentSeason(Date.parse("2026-10-12T12:00:00Z"))).toBe(2026);
    expect(currentSeason(Date.parse("2026-03-01T00:00:00Z"))).toBe(2026);
  });

  it("keeps the playoffs with the season before", () => {
    expect(currentSeason(Date.parse("2027-02-08T12:00:00Z"))).toBe(2026);
  });
});

describe("playoff weeks", () => {
  it("follow the regular season, a round a week", () => {
    expect(playoffRound(18, 18)).toBeNull();
    expect(playoffRound(18, 19)).toBe("wild-card");
    expect(playoffRound(18, 22)).toBe("super-bowl");
    expect(playoffRound(18, 23)).toBeNull();
    expect(playoffRound(17, 18)).toBe("wild-card");
  });

  it("are named, in pages and in URLs", () => {
    expect(weekName(18, 5)).toBe("Week 5");
    expect(weekName(18, 20)).toBe("Divisional Round");
    expect(weekParam(18, 5)).toBe("5");
    expect(weekParam(18, 21)).toBe("conference");
  });

  it("read back from a URL", () => {
    expect(parseWeekParam(18, "5")).toBe(5);
    expect(parseWeekParam(18, "wild-card")).toBe(19);
    expect(parseWeekParam(18, "super-bowl")).toBe(22);
    // A playoff week is named, never numbered.
    expect(parseWeekParam(18, "19")).toBeNull();
    expect(parseWeekParam(18, "0")).toBeNull();
    expect(parseWeekParam(18, "bowl")).toBeNull();
    expect(parseWeekParam(18, undefined)).toBeNull();
  });
});
