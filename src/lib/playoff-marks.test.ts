// @vitest-environment node
import { describe, expect, it } from "vitest";
import { playoffMarksFromEspn } from "~/lib/playoff-marks";
import { TEAMS } from "~/lib/test-utils/fixtures";

/** A team's entry in ESPN's conference standings, with the stats read. */
function entry(teamId: string, seed: number | null, clincher: string) {
  return {
    team: { id: Number(teamId) },
    stats: [
      { name: "wins", value: 12 },
      ...(seed === null ? [] : [{ name: "playoffSeed", value: seed }]),
      { name: "clincher", displayValue: clincher },
    ],
  };
}

describe("playoffMarksFromEspn", () => {
  it("reads each team's seed and clinch code, by team id", () => {
    const marks = playoffMarksFromEspn({
      children: [
        {
          standings: {
            entries: [
              entry(TEAMS.MIN.teamId, 1, "*"),
              entry(TEAMS.NO.teamId, 9, " e "),
            ],
          },
        },
        { standings: { entries: [entry(TEAMS.PIT.teamId, null, "")] } },
      ],
    });
    expect(marks.teams).toEqual({
      [TEAMS.MIN.teamId]: { seed: 1, clincher: "*" },
      [TEAMS.NO.teamId]: { seed: 9, clincher: "e" },
      [TEAMS.PIT.teamId]: { seed: null, clincher: null },
    });
  });

  it("refuses standings that name no teams", () => {
    expect(() => playoffMarksFromEspn({ children: [] })).toThrow();
    expect(() => playoffMarksFromEspn({ children: "nope" })).toThrow();
  });
});
