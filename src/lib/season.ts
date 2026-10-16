import { playoffRound } from "~/lib/season-calendar";
import { type SeasonFile, type SeasonGame } from "~/lib/season.schema";

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

/**
 * A team's regular-season record from finals that kicked off before
 * `kickoff`; a playoff game's is the record the team finished with.
 */
export function recordBefore(
  season: SeasonFile,
  teamId: string,
  kickoff: string,
): TeamRecord {
  const cutoff = Date.parse(kickoff);
  const record: TeamRecord = { wins: 0, losses: 0, ties: 0 };

  for (const game of gamesForTeam(season, teamId)) {
    if (Date.parse(game.kickoff) >= cutoff) break;
    if (game.status !== "final" || !isRegularSeason(season, game)) continue;

    const isHome = game.home.teamId === teamId;
    const own = (isHome ? game.home : game.away).score;
    const other = (isHome ? game.away : game.home).score;
    if (own === null || other === null) continue;

    if (own > other) record.wins += 1;
    else if (own < other) record.losses += 1;
    else record.ties += 1;
  }

  return record;
}
