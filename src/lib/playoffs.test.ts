import { describe, expect, it } from "vitest";
import {
  buildBracket,
  divisionalFeeders,
  isGateOpen,
  matchupGates,
} from "~/lib/playoffs";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

type Side = { teamId: string };

function game(id: string, week: number, home: Side, away: Side) {
  return makeSeasonGame({
    gameId: id,
    week,
    kickoff: `2027-01-${String(week - 8).padStart(2, "0")}T18:00:00.000Z`,
    status: "final",
    home: { teamId: home.teamId, score: 20 },
    away: { teamId: away.teamId, score: 10 },
  });
}

// NFC: MIN, GB, DET, CHI, NO, TB, NYG; AFC: NE, PIT, MIA, NYJ.
const season = makeSeason([
  game("w18-nfc", 18, TEAMS.MIN, TEAMS.GB),
  game("w18-nfc-2", 18, TEAMS.NO, TEAMS.TB),
  game("w18-afc", 18, TEAMS.NE, TEAMS.MIA),
  game("wc-nfc-1", 19, TEAMS.GB, TEAMS.NYG),
  game("wc-nfc-2", 19, TEAMS.DET, TEAMS.CHI),
  game("wc-afc", 19, TEAMS.PIT, TEAMS.NYJ),
  game("div-nfc", 20, TEAMS.MIN, TEAMS.GB),
  game("div-afc", 20, TEAMS.NE, TEAMS.PIT),
  game("conf-nfc", 21, TEAMS.MIN, TEAMS.DET),
  game("conf-afc", 21, TEAMS.NE, TEAMS.MIA),
  game("sb", 22, TEAMS.NE, TEAMS.MIN),
]);

describe("matchupGates", () => {
  const gates = matchupGates(season, REGISTRY);
  const ids = (gameId: string) =>
    gates.get(gameId)?.map((entry) => entry.gameId);

  it("gates a Wild Card game on Week 18 in its conference", () => {
    expect(ids("wc-nfc-1")).toEqual(["w18-nfc", "w18-nfc-2"]);
    expect(ids("wc-afc")).toEqual(["w18-afc"]);
  });

  it("gates each later round on the rounds before in its conference", () => {
    expect(ids("div-nfc")).toEqual([
      "wc-nfc-1",
      "wc-nfc-2",
      "w18-nfc",
      "w18-nfc-2",
    ]);
    expect(ids("conf-afc")).toEqual(["div-afc", "wc-afc", "w18-afc"]);
  });

  it("gates the Super Bowl on both conferences' roads to it", () => {
    expect(ids("sb")?.slice(0, 2)).toEqual(["conf-nfc", "conf-afc"]);
    expect(gates.get("sb")).toHaveLength(10);
  });

  it("leaves the regular season ungated", () => {
    expect(gates.has("w18-nfc")).toBe(false);
  });

  it("opens once every game in the gate is seen", () => {
    const gate = gates.get("div-nfc") ?? [];
    expect(isGateOpen(gate, (game) => game.gameId === "wc-nfc-1")).toBe(false);
    expect(isGateOpen(gate, (game) => game.gameId.startsWith("wc-nfc"))).toBe(
      false,
    );
    expect(isGateOpen(gate, (game) => game.gameId.includes("nfc"))).toBe(true);
  });
});

describe("buildBracket", () => {
  const marks = {
    teams: {
      [TEAMS.MIN.teamId]: { seed: 1, clincher: "*" },
      [TEAMS.GB.teamId]: { seed: 7, clincher: "x" },
      [TEAMS.DET.teamId]: { seed: 3, clincher: "z" },
      [TEAMS.NYG.teamId]: { seed: 2, clincher: "z" },
      [TEAMS.CHI.teamId]: { seed: 6, clincher: "x" },
      [TEAMS.NO.teamId]: { seed: 9, clincher: "e" },
    },
  };
  const bracket = buildBracket(season, REGISTRY, marks);
  const nfc = bracket.conferences.find((entry) => entry.conference === "NFC");

  it("lays out NFC then AFC, rounds in order", () => {
    expect(bracket.conferences.map((entry) => entry.conference)).toEqual([
      "NFC",
      "AFC",
    ]);
    expect(nfc?.rounds.map((round) => [round.round, round.size])).toEqual([
      ["wild-card", 3],
      ["divisional", 2],
      ["conference", 1],
    ]);
    expect(bracket.superBowl?.gameId).toBe("sb");
  });

  it("orders a round by the host's seed and seeds only the field", () => {
    const wildCard = nfc?.rounds[0]?.games ?? [];
    expect(wildCard.map((entry) => entry.gameId)).toEqual([
      "wc-nfc-2",
      "wc-nfc-1",
    ]);
    expect(wildCard[0]?.home.seed).toBe(3);
    // Ninth is out of the field.
    const week18 = buildBracket(
      makeSeason([game("x", 19, TEAMS.NO, TEAMS.TB)]),
      REGISTRY,
      marks,
    );
    expect(week18.conferences[0]?.rounds[0]?.games[0]?.home.seed).toBeNull();
  });

  it("gives the top seed a bye, covered as the Wild Card round is", () => {
    expect(nfc?.bye?.team.abbreviation).toBe("MIN");
    expect(nfc?.bye?.gate.map((entry) => entry.gameId)).toEqual([
      "w18-nfc",
      "w18-nfc-2",
    ]);
  });

  it("names no bye before the Wild Card round is set", () => {
    const early = buildBracket(
      makeSeason([game("w18-nfc", 18, TEAMS.MIN, TEAMS.GB)]),
      REGISTRY,
      marks,
    );
    expect(early.conferences[0]?.bye).toBeNull();
    expect(early.superBowl).toBeNull();
  });
});

describe("divisionalFeeders", () => {
  const marks = {
    teams: {
      [TEAMS.MIN.teamId]: { seed: 1, clincher: "*" },
      [TEAMS.NYG.teamId]: { seed: 2, clincher: "z" },
      [TEAMS.DET.teamId]: { seed: 3, clincher: "z" },
      [TEAMS.NO.teamId]: { seed: 4, clincher: "z" },
      [TEAMS.TB.teamId]: { seed: 5, clincher: "x" },
      [TEAMS.CHI.teamId]: { seed: 6, clincher: "x" },
      [TEAMS.GB.teamId]: { seed: 7, clincher: "x" },
    },
  };
  const wildCard = [
    game("wc-2-7", 19, TEAMS.NYG, TEAMS.GB),
    game("wc-3-6", 19, TEAMS.DET, TEAMS.CHI),
    game("wc-4-5", 19, TEAMS.NO, TEAMS.TB),
  ];
  const nfc = (games: ReturnType<typeof game>[]) =>
    buildBracket(makeSeason(games), REGISTRY, marks).conferences[0]!;

  it("pairs each Divisional game with the games that filled it", () => {
    // The 7 seed won, so it visits the 1; the 3 hosts the 5.
    const feeders = divisionalFeeders(
      nfc([
        ...wildCard,
        game("div-1-7", 20, TEAMS.MIN, TEAMS.GB),
        game("div-3-5", 20, TEAMS.DET, TEAMS.TB),
      ]),
    );
    expect(
      feeders?.map((pair) =>
        pair.map((feeder) =>
          feeder.kind === "bye" ? "bye" : feeder.game.gameId,
        ),
      ),
    ).toEqual([
      ["bye", "wc-2-7"],
      ["wc-3-6", "wc-4-5"],
    ]);
  });

  it("names none until the round is set", () => {
    expect(divisionalFeeders(nfc(wildCard))).toBeNull();
    expect(
      divisionalFeeders(
        nfc([...wildCard, game("div-1-7", 20, TEAMS.MIN, TEAMS.GB)]),
      ),
    ).toBeNull();
  });
});
