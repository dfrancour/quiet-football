import { type Drive } from "~/lib/plays.schema";

/**
 * When each play first reached this page, so a replay following a live game
 * plays a new snap out from its arrival instead of skipping past it, and a
 * broadcast delay holds it back from then. Plays in a game's first load, or
 * not seen arriving at all, read as always available.
 */
const arrivals = new Map<string, number>();
const loadedGames = new Set<string>();

export function notePlayArrivals(
  gameId: string,
  drives: readonly Drive[],
  now: number,
): void {
  // The first load was there before the viewer was, however new.
  const at = loadedGames.has(gameId) ? now : 0;
  loadedGames.add(gameId);
  for (const drive of drives) {
    for (const play of drive.plays) {
      if (!arrivals.has(play.id)) arrivals.set(play.id, at);
    }
  }
}

export function playArrivedAt(playId: string): number {
  return arrivals.get(playId) ?? 0;
}

/** The last of these plays to have arrived by `at`; null for none. */
export function lastArrivedBy(
  plays: readonly { id: string }[],
  at: number,
): string | null {
  return (
    plays.filter((play) => playArrivedAt(play.id) <= at).at(-1)?.id ?? null
  );
}

/** For tests: forget every arrival. */
export function resetPlayArrivals(): void {
  arrivals.clear();
  loadedGames.clear();
}
