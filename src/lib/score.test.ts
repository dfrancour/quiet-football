import { describe, expect, it } from "vitest";
import { extractTeamScore, formatGameClock } from "~/lib/score";

function scoreboard(
  competitors: unknown,
  statusOverrides: unknown = {},
  situation: unknown = undefined,
) {
  return {
    events: [
      {
        id: 401872951,
        competitions: [
          {
            status: {
              displayClock: "8:36",
              period: 3,
              type: {
                state: "in",
                completed: false,
                shortDetail: "8:36 - 3rd",
              },
              ...(statusOverrides as object),
            },
            competitors,
            situation,
          },
        ],
      },
    ],
  };
}

/** Real ESPN ids: Seattle is 26, San Francisco 25. */
const SEA_HOSTS_SF = [
  {
    id: "26",
    homeAway: "home",
    score: "10",
    team: { id: "26", abbreviation: "SEA" },
  },
  {
    id: "25",
    homeAway: "away",
    score: "14",
    team: { id: "25", abbreviation: "SF" },
  },
];

describe("extractTeamScore", () => {
  it("reads string scores from the scoreboard shape", () => {
    const result = extractTeamScore(
      scoreboard([
        { homeAway: "home", score: "7", team: { abbreviation: "NO" } },
        { homeAway: "away", score: "21", team: { abbreviation: "MIN" } },
      ]),
      "MIN",
    );

    expect(result).not.toBeNull();
    expect(result?.team).toEqual({
      abbreviation: "MIN",
      score: 21,
      periods: [],
    });
    expect(result?.opponent).toEqual({
      abbreviation: "NO",
      score: 7,
      periods: [],
    });
    expect(result?.gameId).toBe("401872951");
    expect(result?.state).toBe("in");
    expect(result?.detail).toBe("8:36 - 3rd");
    expect(result?.period).toBe(3);
    expect(result?.clock).toBe("8:36");
    expect(result?.completed).toBe(false);
  });

  it("reads object scores from the summary shape", () => {
    const result = extractTeamScore(
      scoreboard([
        {
          homeAway: "home",
          score: { value: 39, displayValue: "39" },
          team: { abbreviation: "MIN" },
        },
        {
          homeAway: "away",
          score: { value: 22, displayValue: "22" },
          team: { abbreviation: "GB" },
        },
      ]),
      "MIN",
    );

    expect(result?.team.score).toBe(39);
    expect(result?.opponent.score).toBe(22);
  });

  it("falls back to displayValue when value is absent", () => {
    const result = extractTeamScore(
      scoreboard([
        {
          homeAway: "home",
          score: { displayValue: "17" },
          team: { abbreviation: "MIN" },
        },
        {
          homeAway: "away",
          score: { displayValue: "3" },
          team: { abbreviation: "CHI" },
        },
      ]),
      "MIN",
    );

    expect(result?.team.score).toBe(17);
    expect(result?.opponent.score).toBe(3);
  });

  it("returns null scores for a game that has not started", () => {
    const result = extractTeamScore(
      scoreboard(
        [
          { homeAway: "home", score: null, team: { abbreviation: "MIN" } },
          { homeAway: "away", score: null, team: { abbreviation: "IND" } },
        ],
        {
          type: { state: "pre", completed: false, shortDetail: "Sun 12:00 PM" },
        },
      ),
      "MIN",
    );

    expect(result?.state).toBe("pre");
    expect(result?.team.score).toBeNull();
    expect(result?.opponent.score).toBeNull();
  });

  it("maps a completed game to the post state", () => {
    const result = extractTeamScore(
      scoreboard(
        [
          { homeAway: "home", score: "15", team: { abbreviation: "MIN" } },
          { homeAway: "away", score: "10", team: { abbreviation: "MIA" } },
        ],
        { type: { state: "post", completed: true, shortDetail: "Final" } },
      ),
      "MIN",
    );

    expect(result?.state).toBe("post");
    expect(result?.completed).toBe(true);
    expect(result?.detail).toBe("Final");
  });

  it("matches the team case-insensitively", () => {
    const result = extractTeamScore(
      scoreboard([
        { homeAway: "home", score: "7", team: { abbreviation: "min" } },
        { homeAway: "away", score: "3", team: { abbreviation: "chi" } },
      ]),
      "MIN",
    );

    expect(result?.team.abbreviation).toBe("MIN");
    expect(result?.opponent.abbreviation).toBe("CHI");
  });

  it("returns null when the team is not on the scoreboard", () => {
    const result = extractTeamScore(
      scoreboard([
        { homeAway: "home", score: "7", team: { abbreviation: "DET" } },
        { homeAway: "away", score: "3", team: { abbreviation: "CHI" } },
      ]),
      "MIN",
    );

    expect(result).toBeNull();
  });

  it("skips other games to find the right one", () => {
    const payload = {
      events: [
        {
          id: 1,
          competitions: [
            {
              status: { type: { state: "in" } },
              competitors: [
                { homeAway: "home", score: "7", team: { abbreviation: "DET" } },
                { homeAway: "away", score: "3", team: { abbreviation: "CHI" } },
              ],
            },
          ],
        },
        {
          id: 2,
          competitions: [
            {
              status: { type: { state: "in" } },
              competitors: [
                { homeAway: "home", score: "14", team: { abbreviation: "NO" } },
                {
                  homeAway: "away",
                  score: "28",
                  team: { abbreviation: "MIN" },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = extractTeamScore(payload, "MIN");
    expect(result?.gameId).toBe("2");
    expect(result?.team.score).toBe(28);
  });

  it("returns null for a malformed payload instead of throwing", () => {
    expect(extractTeamScore(null, "MIN")).toBeNull();
    expect(extractTeamScore({ events: "nope" }, "MIN")).toBeNull();
    expect(extractTeamScore({}, "MIN")).toBeNull();
  });

  it("defaults the detail when ESPN omits every status label", () => {
    const result = extractTeamScore(
      scoreboard(
        [
          { homeAway: "home", score: "0", team: { abbreviation: "MIN" } },
          { homeAway: "away", score: "0", team: { abbreviation: "GB" } },
        ],
        { type: {} },
      ),
      "MIN",
    );

    expect(result?.detail).toBe("Scheduled");
    expect(result?.state).toBe("pre");
  });
});

describe("extractTeamScore situation", () => {
  it("orients possession and timeouts to the followed team", () => {
    const payload = scoreboard(
      SEA_HOSTS_SF,
      {},
      {
        downDistanceText: "4th & 21 at SF 32",
        possession: "26",
        isRedZone: false,
        homeTimeouts: 1,
        awayTimeouts: 3,
        lastPlay: {
          text: " (Shotgun) E.Wilson up the middle to SF 32 for 5 yards.",
          drive: { description: "10 plays, 35 yards, 6:17" },
        },
      },
    );

    expect(extractTeamScore(payload, "SEA")?.situation).toEqual({
      downDistance: "4th & 21 at SF 32",
      possession: "team",
      isRedZone: false,
      timeouts: { team: 1, opponent: 3 },
      lastPlay: "E.Wilson up the middle to SF 32 for 5 yards.",
      drive: "10 plays, 35 yards, 6:17",
      field: null,
    });

    const fromSf = extractTeamScore(payload, "SF")?.situation;
    expect(fromSf?.possession).toBe("opponent");
    expect(fromSf?.timeouts).toEqual({ team: 3, opponent: 1 });
  });

  it("drops a stale red-zone flag once nobody has the ball", () => {
    // ESPN's shape just after a touchdown: down -1, no snap text, no possession.
    const result = extractTeamScore(
      scoreboard(
        SEA_HOSTS_SF,
        {},
        {
          down: -1,
          isRedZone: true,
          homeTimeouts: 2,
          awayTimeouts: 2,
          lastPlay: { text: "J.Goff pass short left for 8 yards, TOUCHDOWN." },
        },
      ),
      "SEA",
    );

    expect(result?.situation).toMatchObject({
      downDistance: null,
      possession: null,
      isRedZone: false,
      drive: null,
    });
  });

  it("has no situation for a game that is not under way", () => {
    const result = extractTeamScore(scoreboard(SEA_HOSTS_SF), "SEA");
    expect(result?.situation).toBeNull();
  });
});

describe("extractTeamScore field", () => {
  it("places the home offense in ESPN's home-goal frame", () => {
    // Real: SEA ball, 4th & 10 at SF 22, drive began at SEA 45.
    const payload = scoreboard(
      SEA_HOSTS_SF,
      {},
      {
        down: 4,
        distance: 10,
        yardLine: 78,
        downDistanceText: "4th & 10 at SF 22",
        possession: "26",
        lastPlay: { team: { id: "26" }, drive: { start: { yardLine: 45 } } },
      },
    );

    expect(extractTeamScore(payload, "SF")?.situation?.field).toEqual({
      offense: "home",
      ballOn: 78,
      lineToGain: 88,
      driveSpots: [45, 78],
    });
  });

  it("places the away offense counting toward the home goal", () => {
    // Real: SF ball, 1st & 10 at SF 26 to open a drive.
    const payload = scoreboard(
      SEA_HOSTS_SF,
      {},
      {
        down: 1,
        distance: 10,
        yardLine: 74,
        downDistanceText: "1st & 10 at SF 26",
        possession: "25",
        lastPlay: { team: { id: "25" }, drive: { start: { yardLine: 74 } } },
      },
    );

    expect(extractTeamScore(payload, "SEA")?.situation?.field).toEqual({
      offense: "away",
      ballOn: 74,
      lineToGain: 64,
      driveSpots: [74],
    });
  });

  it("ignores a drive start left over from the other side's possession", () => {
    const payload = scoreboard(
      SEA_HOSTS_SF,
      {},
      {
        down: 1,
        distance: 10,
        yardLine: 25,
        downDistanceText: "1st & 10 at SEA 25",
        possession: "26",
        lastPlay: { team: { id: "25" }, drive: { start: { yardLine: 70 } } },
      },
    );

    expect(
      extractTeamScore(payload, "SEA")?.situation?.field?.driveSpots,
    ).toEqual([25]);
  });

  it("keeps the ball but draws no line to gain while no snap is pending", () => {
    const payload = scoreboard(
      SEA_HOSTS_SF,
      {},
      {
        down: -1,
        distance: 10,
        yardLine: 35,
        possession: "26",
      },
    );

    expect(extractTeamScore(payload, "SEA")?.situation?.field).toMatchObject({
      ballOn: 35,
      lineToGain: null,
    });
  });

  it("has no field when nobody has the ball", () => {
    const payload = scoreboard(SEA_HOSTS_SF, {}, { yardLine: 48 });
    expect(extractTeamScore(payload, "SEA")?.situation?.field).toBeNull();
  });
});

describe("extractTeamScore periods", () => {
  it("reads points per period in order, wherever ESPN lists them", () => {
    const result = extractTeamScore(
      scoreboard([
        {
          homeAway: "home",
          score: "29",
          team: { abbreviation: "SEA" },
          linescores: [
            { value: 13, period: 3 },
            { value: 7, period: 1 },
            { value: 6, period: 2 },
            { value: 3, period: 4 },
          ],
        },
        {
          homeAway: "away",
          score: "32",
          team: { abbreviation: "SF" },
          linescores: [
            { value: 7, period: 1 },
            { value: 14, period: 2 },
          ],
        },
      ]),
      "SEA",
    );

    expect(result?.team.periods).toEqual([7, 6, 13, 3]);
    expect(result?.opponent.periods).toEqual([7, 14]);
  });
});

describe("formatGameClock", () => {
  const at = (detail: string, period: number | null, clock: string | null) =>
    formatGameClock({ detail, period, clock });

  it("leads with the quarter and pads the minutes", () => {
    expect(at("0:47 - 4th", 4, "0:47")).toBe("Q4 - 00:47");
    expect(at("12:05 - 1st", 1, "12:05")).toBe("Q1 - 12:05");
  });

  it("names overtime periods", () => {
    expect(at("8:12 - OT", 5, "8:12")).toBe("OT - 08:12");
    expect(at("3:00 - 2OT", 6, "3:00")).toBe("2OT - 03:00");
  });

  it("keeps ESPN's wording for breaks in play", () => {
    expect(at("Halftime", 2, "0:00")).toBe("Halftime");
    expect(at("End of 3rd", 3, "0:00")).toBe("End of 3rd");
  });

  it("keeps ESPN's wording when the clock is missing", () => {
    expect(at("0:47 - 4th", 4, null)).toBe("0:47 - 4th");
  });
});
