import { playoffRound } from "~/lib/season-calendar";
import {
  type GameOutcome,
  type SeasonFile,
  type SeasonGame,
} from "~/lib/season.schema";
import { type RecordsShown } from "~/lib/spoilers";

/** Games involving a team, in kickoff order. */
export function gamesForTeam(season: SeasonFile, teamId: string) {
  return season.games
    .filter(
      (game) => game.home.teamId === teamId || game.away.teamId === teamId,
    )
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
}

/** Records and standings count these only. */
export function isRegularSeason(
  season: Pick<SeasonFile, "totalWeeks">,
  game: Pick<SeasonGame, "week">,
): boolean {
  return playoffRound(season.totalWeeks, game.week) === null;
}

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
}

export const NO_RECORD: TeamRecord = { wins: 0, losses: 0, ties: 0 };

export function outcomeOf(own: number, other: number): GameOutcome {
  if (own > other) return "win";
  if (own < other) return "loss";
  return "tie";
}

export function addOutcome(
  record: TeamRecord,
  outcome: GameOutcome,
): TeamRecord {
  switch (outcome) {
    case "win":
      return { ...record, wins: record.wins + 1 };
    case "loss":
      return { ...record, losses: record.losses + 1 };
    case "tie":
      return { ...record, ties: record.ties + 1 };
  }
}

/** A final's outcome from one side; null for a game not final or unscored. */
function finalOutcome(game: SeasonGame, side: "home" | "away") {
  const own = game[side].score;
  const other = game[side === "home" ? "away" : "home"].score;
  return game.status === "final" && own !== null && other !== null
    ? outcomeOf(own, other)
    : null;
}

/** A side's regular-season record going into a game, and coming out of it. */
export interface RecordsAround {
  before: TeamRecord;
  after: TeamRecord;
}

/**
 * Every game's records, by game id and side, from one pass in kickoff order:
 * the side's regular-season finals before it, then with it. A playoff game
 * counts for neither, so both are the record the team finished with.
 */
export function recordsAround(
  season: SeasonFile,
): ReadonlyMap<string, Record<"home" | "away", RecordsAround>> {
  const running = new Map<string, TeamRecord>();
  const around = new Map<string, Record<"home" | "away", RecordsAround>>();
  const byKickoff = [...season.games].sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff),
  );
  const step = (game: SeasonGame, side: "home" | "away"): RecordsAround => {
    const before = running.get(game[side].teamId) ?? NO_RECORD;
    const outcome = isRegularSeason(season, game)
      ? finalOutcome(game, side)
      : null;
    const after = outcome ? addOutcome(before, outcome) : before;
    running.set(game[side].teamId, after);
    return { before, after };
  };
  for (const game of byKickoff) {
    around.set(game.gameId, {
      home: step(game, "home"),
      away: step(game, "away"),
    });
  }
  return around;
}

/** A team's regular-season record from the finals of weeks through `week`. */
export function recordThroughWeek(
  season: SeasonFile,
  teamId: string,
  week: number,
): TeamRecord {
  let record = NO_RECORD;
  for (const game of season.games) {
    if (game.week > week || !isRegularSeason(season, game)) continue;
    for (const side of ["home", "away"] as const) {
      const outcome =
        game[side].teamId === teamId ? finalOutcome(game, side) : null;
      if (outcome) record = addOutcome(record, outcome);
    }
  }
  return record;
}

/** A side's record as `shown` names it (`recordsShown`). */
export function recordAsShown(
  season: SeasonFile,
  shown: NonNullable<RecordsShown>,
  teamId: string,
  around: RecordsAround,
): TeamRecord {
  switch (shown.at) {
    case "after":
      return around.after;
    case "before":
      return around.before;
    case "through":
      return recordThroughWeek(season, teamId, shown.week);
  }
}
