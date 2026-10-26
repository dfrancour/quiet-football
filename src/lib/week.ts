import { matchupGates, type GateGame } from "~/lib/playoffs";
import { gamePhase } from "~/lib/schedule";
import {
  NO_RECORD,
  recordAsShown,
  recordsAround,
  type TeamRecord,
} from "~/lib/season";
import { playoffRound, type PlayoffRound } from "~/lib/season-calendar";
import { type SeasonFile, type SeasonGame } from "~/lib/season.schema";
import { type RecordsShown } from "~/lib/spoilers";
import { teamById } from "~/lib/teams";
import { type Team, type TeamRegistry } from "~/lib/teams.schema";

export interface WeekSide {
  team: Team;
  score: number | null;
  recordBefore: TeamRecord;
  /** Counting this game too, once it is final and in the regular season. */
  recordAfter: TeamRecord;
}

export interface WeekGame {
  gameId: string;
  week: number;
  /** Null in the regular season. */
  round: PlayoffRound | null;
  /** Games to be seen before a playoff matchup is shown (`playoffs.ts`). */
  gate: GateGame[];
  kickoff: string;
  status: SeasonGame["status"];
  broadcast: string | null;
  away: WeekSide;
  home: WeekSide;
}

/**
 * The week holding the next game the store has not settled. After the season,
 * the last week. Without a clock, the scoreboard's word on each game decides.
 */
export function currentWeek(season: SeasonFile, now: number | null): number {
  const ordered = [...season.games].sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff),
  );
  const next = ordered.find((game) => {
    if (now === null) {
      return game.status === "scheduled" || game.status === "in_progress";
    }
    const phase = gamePhase(game, now);
    return phase === "upcoming" || phase === "pregame" || phase === "live";
  });
  if (next) return next.week;
  return ordered.at(-1)?.week ?? 1;
}

/**
 * The last week with every game in it, and every week before, settled (final
 * or canceled): as far as a viewer can catch up. Zero before any is.
 */
export function settledThrough(season: SeasonFile): number {
  const unsettled = season.games
    .filter((game) => game.status !== "final" && game.status !== "canceled")
    .map((game) => game.week);
  const last = Math.max(0, ...season.games.map((game) => game.week));
  return unsettled.length === 0 ? last : Math.min(...unsettled) - 1;
}

export interface WeekInProgress {
  week: number;
  /** The games in it already over, oldest kickoff first. */
  finalGameIds: string[];
}

/**
 * The week after the last settled one, once a game in it is final: a viewer
 * can catch up into it, taking its finished games as seen. Null while none
 * of its games is over, or the season is settled.
 */
export function weekInProgress(season: SeasonFile): WeekInProgress | null {
  const week = settledThrough(season) + 1;
  const finalGameIds = season.games
    .filter((game) => game.week === week && game.status === "final")
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .map((game) => game.gameId);
  return finalGameIds.length > 0 ? { week, finalGameIds } : null;
}

export function buildLeagueGames(
  season: SeasonFile,
  registry: TeamRegistry,
): WeekGame[] {
  const gates = matchupGates(season, registry);
  const records = recordsAround(season);
  return (
    [...season.games]
      // Games kicking off together keep the season file's order.
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
      .flatMap((game) => {
        const away = teamById(registry, game.away.teamId);
        const home = teamById(registry, game.home.teamId);
        if (!away || !home) return [];
        return [
          {
            gameId: game.gameId,
            week: game.week,
            round: playoffRound(season.totalWeeks, game.week),
            gate: gates.get(game.gameId) ?? [],
            kickoff: game.kickoff,
            status: game.status,
            broadcast: game.broadcast,
            away: {
              team: away,
              score: game.away.score,
              recordBefore: records.get(game.gameId)?.away.before ?? NO_RECORD,
              recordAfter: records.get(game.gameId)?.away.after ?? NO_RECORD,
            },
            home: {
              team: home,
              score: game.home.score,
              recordBefore: records.get(game.gameId)?.home.before ?? NO_RECORD,
              recordAfter: records.get(game.gameId)?.home.after ?? NO_RECORD,
            },
          },
        ];
      })
  );
}

/** The records `shown` names for both sides of a game; null for none. */
export function weekGameRecords(
  season: SeasonFile,
  game: WeekGame,
  shown: RecordsShown,
): { away: TeamRecord; home: TeamRecord } | null {
  if (shown === null) return null;
  const sideRecord = (side: WeekSide) =>
    recordAsShown(season, shown, side.team.teamId, {
      before: side.recordBefore,
      after: side.recordAfter,
    });
  return { away: sideRecord(game.away), home: sideRecord(game.home) };
}
