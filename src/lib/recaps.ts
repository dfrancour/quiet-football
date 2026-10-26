/**
 * A game's recap, keyed by game, not team; the week is joined from the game.
 * No title: a title can give the result away, and nothing may show one.
 */
export interface Recap {
  youtubeId: string;
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
