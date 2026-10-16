import { describe, expect, it } from "vitest";
import { buildStandings, winPct } from "~/lib/standings";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

function final(
  week: number,
  home: { teamId: string },
  homeScore: number,
  away: { teamId: string },
  awayScore: number,
) {
  return makeSeasonGame({
    gameId: `${week}-${home.teamId}-${away.teamId}`,
    week,
    kickoff: `2026-09-${String(week + 9).padStart(2, "0")}T17:00:00.000Z`,
    status: "final",
    home: { teamId: home.teamId, score: homeScore },
    away: { teamId: away.teamId, score: awayScore },
  });
}

function divisionOrder(
  standings: ReturnType<typeof buildStandings>,
  conference: string,
  division: string,
) {
  return standings
    .find((entry) => entry.conference === conference)
    ?.divisions.find((entry) => entry.division === division)
    ?.rows.map((row) => row.team.abbreviation);
}

describe("standings figures", () => {
  it("counts a tie as half a win", () => {
    expect(winPct({ wins: 3, losses: 1, ties: 1 })).toBeCloseTo(0.7);
    expect(winPct({ wins: 0, losses: 0, ties: 0 })).toBe(0);
  });
});

describe("buildStandings", () => {
  it("lays out NFC then AFC, each North, East, South, West", () => {
    const standings = buildStandings(makeSeason([]), REGISTRY);
    expect(standings.map((entry) => entry.conference)).toEqual(["NFC", "AFC"]);
    expect(standings[0]?.divisions.map((entry) => entry.division)).toEqual([
      "North",
      "East",
      "South",
      "West",
    ]);
  });

  it("derives records and the current streak from finals in kickoff order", () => {
    const standings = buildStandings(
      makeSeason([
        final(1, TEAMS.MIN, 10, TEAMS.GB, 20),
        final(2, TEAMS.CHI, 3, TEAMS.MIN, 9),
        final(3, TEAMS.MIN, 24, TEAMS.DET, 17),
      ]),
      REGISTRY,
    );
    const min = standings[0]?.divisions
      .find((entry) => entry.division === "North")
      ?.rows.find((row) => row.team.abbreviation === "MIN");

    expect(min?.record).toEqual({ wins: 2, losses: 1, ties: 0 });
    expect(min?.streak).toEqual({ outcome: "win", length: 2 });
  });

  it("counts the regular season only", () => {
    const standings = buildStandings(
      makeSeason([
        final(18, TEAMS.MIN, 24, TEAMS.DET, 17),
        final(19, TEAMS.MIN, 10, TEAMS.GB, 20),
      ]),
      REGISTRY,
    );
    const min = standings[0]?.divisions
      .find((entry) => entry.division === "North")
      ?.rows.find((row) => row.team.abbreviation === "MIN");
    expect(min?.record).toEqual({ wins: 1, losses: 0, ties: 0 });
  });

  it("breaks a tie on head-to-head before anything else", () => {
    // GB and DET are both 1-1; DET won the meeting.
    const standings = buildStandings(
      makeSeason([
        final(1, TEAMS.GB, 20, TEAMS.MIA, 10),
        final(2, TEAMS.GB, 10, TEAMS.DET, 13),
        final(3, TEAMS.DET, 3, TEAMS.NE, 30),
      ]),
      REGISTRY,
    );
    expect(divisionOrder(standings, "NFC", "North")?.slice(0, 2)).toEqual([
      "DET",
      "GB",
    ]);
  });

  it("falls back to common games when the tied teams have not met", () => {
    // DET and CHI are 1-1. Both played NE; only CHI beat them.
    const standings = buildStandings(
      makeSeason([
        final(1, TEAMS.DET, 10, TEAMS.NE, 20),
        final(2, TEAMS.DET, 20, TEAMS.MIA, 10),
        final(3, TEAMS.CHI, 20, TEAMS.NE, 10),
        final(4, TEAMS.CHI, 10, TEAMS.NYJ, 20),
      ]),
      REGISTRY,
    );
    const order = divisionOrder(standings, "NFC", "North") ?? [];
    expect(order.indexOf("CHI")).toBeLessThan(order.indexOf("DET"));
  });

  const { CHI, DET, GB, MIA, NE, NYG, TB, WSH } = TEAMS;
  const northOrder = (games: ReturnType<typeof final>[]) =>
    divisionOrder(
      buildStandings(makeSeason(games), REGISTRY),
      "NFC",
      "North",
    ) ?? [];
  const above = (order: string[], a: string, b: string) =>
    order.indexOf(a) < order.indexOf(b);

  it("breaks a tie with no meeting by division record, an empty one counting as none won", () => {
    const order = northOrder([
      final(1, GB, 20, CHI, 10),
      final(2, NYG, 20, GB, 10),
      final(1, DET, 20, WSH, 10),
      final(2, NYG, 20, DET, 10),
    ]);
    expect(above(order, "GB", "DET")).toBe(true);
  });

  it("falls to conference record when nothing nearer separates them", () => {
    const order = northOrder([
      final(1, CHI, 20, NE, 10),
      final(2, TB, 20, CHI, 10),
      final(1, DET, 20, NYG, 10),
      final(2, MIA, 20, DET, 10),
    ]);
    expect(above(order, "DET", "CHI")).toBe(true);
  });

  it("then prefers more wins, as when ties make the percentages equal", () => {
    const order = northOrder([
      final(1, CHI, 10, NE, 10),
      final(2, MIA, 10, CHI, 10),
      final(1, DET, 20, NE, 10),
      final(2, MIA, 20, DET, 10),
    ]);
    expect(above(order, "DET", "CHI")).toBe(true);
  });

  it("orders a tie nothing breaks by name", () => {
    expect(northOrder([])).toEqual(["CHI", "DET", "GB", "MIN"]);
  });
});
