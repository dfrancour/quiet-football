import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";

/**
 * The viewer's place in each game: the furthest play they have seen. It only
 * moves forward, since a play once seen cannot be unseen, and it reveals
 * nothing unseen, so unlike the spoiler cookie it does not expire.
 */
const progressSchema = z.object({
  /** The furthest play whose result the viewer has seen; null for none. */
  playId: z.string().nullable(),
  /** Seen to the end of a game that is over, by watching or uncovering it. */
  finished: z.boolean(),
});
export type WatchProgress = z.infer<typeof progressSchema>;

export type WatchProgressByGame = Readonly<Record<string, WatchProgress>>;

const store = createLocalStore<WatchProgressByGame>(
  "watch-progress",
  z.record(z.string(), progressSchema),
  {},
);

export const subscribeToWatchProgress = store.subscribe;
export const getWatchProgress = store.get;
export const getServerWatchProgress = store.getServer;
export const resetWatchProgressCache = store.resetCache;

export function recordWatchProgress(
  gameId: string,
  progress: WatchProgress,
): void {
  store.set({ ...store.get(), [gameId]: progress });
}

/** The viewer uncovered finished games: each reads as watched to the end. */
export function finishGames(gameIds: readonly string[]): void {
  const stored = store.get();
  store.set({
    ...stored,
    ...Object.fromEntries(
      gameIds.map((gameId) => [
        gameId,
        { playId: stored[gameId]?.playId ?? null, finished: true },
      ]),
    ),
  });
}

/** The viewer uncovered a finished game: it reads as watched to the end. */
export function finishGame(gameId: string): void {
  finishGames([gameId]);
}
