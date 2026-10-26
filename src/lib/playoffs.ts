import { PLAYOFF_SEEDS } from "~/lib/playoff-marks";
import { type PlayoffMarks } from "~/lib/playoff-marks.schema";
import {
  PLAYOFF_ROUNDS,
  playoffRound,
  playoffWeek,
  type PlayoffRound,
} from "~/lib/season-calendar";
import { type SeasonFile, type SeasonGame } from "~/lib/season.schema";
import { CONFERENCE_ORDER, teamById } from "~/lib/teams";
import {
  type Conference,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";

/**
 * A playoff matchup gives away the round before it: a Divisional game says
 * who won on Wild Card weekend, and the Wild Card field how the regular season
 * ended. So with spoilers hidden, a playoff game's teams stay covered until
 * the games that decided them are seen. That is its gate: Week 18 in its
 * conference for a Wild Card game, the round before in its conference after
 * that, and both Conference Championships for the Super Bowl, each with the
 * gates of those games, since a matchup also gives away the rounds before.
 */

function conferenceOf(
  registry: TeamRegistry,
  game: SeasonGame,
): Conference | null {
  return teamById(registry, game.home.teamId)?.conference ?? null;
}

/** A game in a gate, with its week, which being caught up covers. */
export interface GateGame {
  gameId: string;
  week: number;
}

/** By game id, for every playoff game: the games that must be seen first. */
export function matchupGates(
  season: SeasonFile,
  registry: TeamRegistry,
): Map<string, GateGame[]> {
  const inWeek = (week: number, conference: Conference | null) =>
    season.games
      .filter(
        (game) =>
          game.week === week &&
          (conference === null || conferenceOf(registry, game) === conference),
      )
      .map((game) => ({ gameId: game.gameId, week: game.week }));

  const gates = new Map<string, GateGame[]>();
  // By week, so the round before is gated first.
  const byWeek = [...season.games].sort((a, b) => a.week - b.week);
  for (const game of byWeek) {
    const round = playoffRound(season.totalWeeks, game.week);
    if (round === null) continue;
    const conference =
      round === "super-bowl" ? null : conferenceOf(registry, game);
    const before = inWeek(game.week - 1, conference);
    const all = [
      ...before,
      ...before.flatMap((entry) => gates.get(entry.gameId) ?? []),
    ];
    gates.set(game.gameId, [
      ...new Map(all.map((entry) => [entry.gameId, entry])).values(),
    ]);
  }
  return gates;
}

/** Whether a gate is open: every game in it is seen. */
export function isGateOpen(
  gate: readonly GateGame[],
  seen: (game: GateGame) => boolean,
): boolean {
  return gate.every(seen);
}

export interface BracketSide {
  team: Team;
  /** Null when ESPN has not seeded the team. */
  seed: number | null;
  score: number | null;
}

export interface BracketGame {
  gameId: string;
  week: number;
  round: PlayoffRound;
  kickoff: string;
  status: SeasonGame["status"];
  away: BracketSide;
  home: BracketSide;
  gate: GateGame[];
}

export interface BracketRound {
  round: PlayoffRound;
  games: BracketGame[];
  /** How many games the round has once set. */
  size: number;
}

export interface ConferenceBracket {
  conference: Conference;
  /** The top seed, which skips the Wild Card round; null until it is known. */
  bye: { team: Team; seed: number; gate: GateGame[] } | null;
  rounds: BracketRound[];
}

export interface Bracket {
  conferences: ConferenceBracket[];
  superBowl: BracketGame | null;
}

/** Games a round has per conference (the Super Bowl, in all). */
const ROUND_SIZE: Readonly<Record<PlayoffRound, number>> = {
  "wild-card": 3,
  divisional: 2,
  conference: 1,
  "super-bowl": 1,
};

/**
 * The postseason as stored, seeded from ESPN's marks. Rounds not yet set are
 * empty; the NFL reseeds after the Wild Card round, so rounds are lists, not a
 * fixed tree.
 */
export function buildBracket(
  season: SeasonFile,
  registry: TeamRegistry,
  marks: PlayoffMarks | null,
): Bracket {
  const gates = matchupGates(season, registry);
  const seedOf = (teamId: string) => {
    const seed = marks?.teams[teamId]?.seed ?? null;
    return seed !== null && seed <= PLAYOFF_SEEDS ? seed : null;
  };

  const games: { game: BracketGame; conference: Conference | null }[] =
    season.games.flatMap((game) => {
      const round = playoffRound(season.totalWeeks, game.week);
      const home = teamById(registry, game.home.teamId);
      const away = teamById(registry, game.away.teamId);
      if (round === null || !home || !away) return [];
      return [
        {
          conference: round === "super-bowl" ? null : home.conference,
          game: {
            gameId: game.gameId,
            week: game.week,
            round,
            kickoff: game.kickoff,
            status: game.status,
            home: {
              team: home,
              seed: seedOf(home.teamId),
              score: game.home.score,
            },
            away: {
              team: away,
              seed: seedOf(away.teamId),
              score: game.away.score,
            },
            gate: gates.get(game.gameId) ?? [],
          },
        },
      ];
    });

  // The higher seed hosts, so home seeds order a round.
  const bySeed = (a: BracketGame, b: BracketGame) =>
    (a.home.seed ?? PLAYOFF_SEEDS + 1) - (b.home.seed ?? PLAYOFF_SEEDS + 1) ||
    Date.parse(a.kickoff) - Date.parse(b.kickoff);

  const conferences = CONFERENCE_ORDER.map((conference): ConferenceBracket => {
    const rounds = PLAYOFF_ROUNDS.filter((round) => round !== "super-bowl").map(
      (round) => ({
        round,
        size: ROUND_SIZE[round],
        games: games
          .filter(
            (entry) =>
              entry.game.round === round && entry.conference === conference,
          )
          .map((entry) => entry.game)
          .sort(bySeed),
      }),
    );

    // The top seed is known once the Wild Card round is set, and is covered
    // as that round is.
    const wildCard = rounds[0]?.games ?? [];
    const top = registry.teams.find(
      (team) => team.conference === conference && seedOf(team.teamId) === 1,
    );
    const bye =
      top && wildCard.length > 0
        ? { team: top, seed: 1, gate: wildCard[0]?.gate ?? [] }
        : null;

    return { conference, bye, rounds };
  });

  const superBowl =
    games.find(
      (entry) =>
        entry.game.week === playoffWeek(season.totalWeeks, "super-bowl"),
    )?.game ?? null;

  return { conferences, superBowl };
}

/** What fills one side of a Divisional game: a Wild Card game, or the bye. */
export type Feeder = { kind: "bye" } | { kind: "game"; game: BracketGame };

/**
 * Each Divisional game's two feeders, the host's first. Null until the round
 * is set: the NFL reseeds, so who meets whom depends on the Wild Card results.
 */
export function divisionalFeeders(
  conference: ConferenceBracket,
): [Feeder, Feeder][] | null {
  const [wildCard, divisional] = conference.rounds;
  if (!wildCard || !divisional) return null;
  if (divisional.games.length < divisional.size) return null;

  const feederOf = (teamId: string): Feeder | null => {
    if (conference.bye?.team.teamId === teamId) return { kind: "bye" };
    const game = wildCard.games.find(
      (entry) =>
        entry.home.team.teamId === teamId || entry.away.team.teamId === teamId,
    );
    return game ? { kind: "game", game } : null;
  };

  const pairs: [Feeder, Feeder][] = [];
  for (const game of divisional.games) {
    const host = feederOf(game.home.team.teamId);
    const visitor = feederOf(game.away.team.teamId);
    if (!host || !visitor) return null;
    pairs.push([host, visitor]);
  }
  return pairs;
}
