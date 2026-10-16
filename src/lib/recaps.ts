import { weekLabel } from "~/lib/schedule";
import { type TeamGame } from "~/lib/team-view";
import { type Team } from "~/lib/teams.schema";

/**
 * A game's recap, keyed by game, not team; the week is joined from the game.
 * No title: a title can give the result away, and nothing may show one.
 */
export interface Recap {
  youtubeId: string;
  /** YouTube's publish time. */
  publishedAt: string;
}

/** A season's recaps, derived from the dataset (`recapsFromDataset`). */
export interface RecapsFile {
  season: number;
  recaps: Readonly<Record<string, Recap>>;
}

export function findRecap(file: RecapsFile, gameId: string): Recap | null {
  return file.recaps[gameId] ?? null;
}

export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

/** Fallback for a game with no recap linked yet. */
export function youtubeSearchUrl(
  game: TeamGame,
  team: Team,
  season: number,
): string {
  const query = [
    game.opponent.displayName,
    team.displayName,
    "game highlights",
    String(season),
    weekLabel(game).toLowerCase(),
  ].join(" ");

  const params = new URLSearchParams({ search_query: query });
  return `https://www.youtube.com/results?${params.toString()}`;
}
