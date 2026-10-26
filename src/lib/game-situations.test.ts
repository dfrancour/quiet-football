import { describe, expect, it } from "vitest";
import { noteSituations, situationAfter } from "~/lib/game-situations";
import { scoreboardSchema } from "~/lib/score.schema";

/** ATL hosting BAL, ATL's ball after play `playId`. */
function board(playId: string, yardLine: number) {
  return scoreboardSchema.parse({
    events: [
      {
        id: "g1",
        competitions: [
          {
            competitors: [
              { id: "1", homeAway: "home", team: { abbreviation: "ATL" } },
              { id: "33", homeAway: "away", team: { abbreviation: "BAL" } },
            ],
            situation: {
              down: 1,
              distance: 10,
              yardLine,
              downDistanceText: `1st & 10 at ATL ${yardLine}`,
              possession: "1",
              homeTimeouts: 3,
              awayTimeouts: 2,
              lastPlay: { id: playId, text: "A play." },
            },
          },
        ],
      },
    ],
  });
}

describe("situationAfter", () => {
  it("gives the game as the scoreboard left it after a play, from either side", () => {
    noteSituations(board("p3", 42));
    expect(situationAfter("g1", "p3", "ATL")).toMatchObject({
      downDistance: "1st & 10 at ATL 42",
      possession: "team",
      timeouts: { team: 3, opponent: 2 },
      field: { offense: "home", ballOn: 42, lineToGain: 52 },
    });
    expect(situationAfter("g1", "p3", "BAL")).toMatchObject({
      possession: "opponent",
      timeouts: { team: 2, opponent: 3 },
    });
  });

  it("keeps each play's moment as the scoreboard moves on", () => {
    noteSituations(board("p3", 42));
    noteSituations(board("p4", 45));
    expect(situationAfter("g1", "p3", "ATL")?.field?.ballOn).toBe(42);
    expect(situationAfter("g1", "p4", "ATL")?.field?.ballOn).toBe(45);
  });

  it("takes the newest word on a play, as ESPN respots it", () => {
    noteSituations(board("p3", 42));
    noteSituations(board("p3", 37));
    expect(situationAfter("g1", "p3", "ATL")?.field?.ballOn).toBe(37);
  });

  it("knows nothing of a play no poll saw last", () => {
    noteSituations(board("p3", 42));
    expect(situationAfter("g1", "p2", "ATL")).toBeNull();
    expect(situationAfter("g2", "p3", "ATL")).toBeNull();
  });
});
