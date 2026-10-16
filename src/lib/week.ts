import { matchupGates, type GateGame } from "~/lib/playoffs";
import { gamePhase } from "~/lib/schedule";
import { recordBefore, type TeamRecord } from "~/lib/season";
import { playoffRound, type PlayoffRound } from "~/lib/season-calendar";
import { type SeasonFile, type SeasonGame } from "~/lib/season.schema";
import { teamById } from "~/lib/teams";
import { type Team, type TeamRegistry } from "~/lib/teams.schema";

export interface WeekSide {
  team: Team;
  score: number | null;
  recordBefore: TeamRecord;
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
 * the last week.
 */
export function currentWeek(season: SeasonFile, now: number): number {
  const ordered = [...season.games].sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff),
  );
  const next = ordered.find((game) => {
    const phase = gamePhase(game, now);
    return phase === "upcoming" || phase === "pregame" || phase === "live";
  });
  if (next) return next.week;
  return ordered.at(-1)?.week ?? 1;
}

export function currentWeekNow(season: SeasonFile): number {
  return currentWeek(season, Date.now());
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

export function buildLeagueGames(
  season: SeasonFile,
  registry: TeamRegistry,
): WeekGame[] {
  const gates = matchupGates(season, registry);
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
              recordBefore: recordBefore(season, away.teamId, game.kickoff),
            },
            home: {
              team: home,
              score: game.home.score,
              recordBefore: recordBefore(season, home.teamId, game.kickoff),
            },
          },
        ];
      })
  );
}
