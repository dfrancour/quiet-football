"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type Play } from "~/lib/plays.schema";
import {
  getServerWatchProgress,
  getWatchProgress,
  recordWatchProgress,
  subscribeToWatchProgress,
  type WatchProgress,
  type WatchProgressByGame,
} from "~/lib/watch-progress";

/** Every game's place, for a view that lists them. */
export function useWatchProgressByGame(): WatchProgressByGame {
  return useSyncExternalStore(
    subscribeToWatchProgress,
    getWatchProgress,
    getServerWatchProgress,
  );
}

/**
 * The stored place in one game, if it names one of these plays or the game
 * was seen to the end. Null before anything is watched or the plays load.
 */
export function useWatchProgress(
  gameId: string | null,
  plays: Play[],
): WatchProgress | null {
  const stored = useWatchProgressByGame()[gameId ?? ""] ?? null;
  return stored !== null &&
    (stored.finished || plays.some((play) => play.id === stored.playId))
    ? stored
    : null;
}

/**
 * The viewer's place in a game: the furthest play seen. The field moves it
 * forward, never back, so stepping back or watching again unsees nothing.
 *
 * `revealedId` is the last play whose result is on the field, counted
 * immediately rather than waiting on the store; null counts nothing. `over` means reaching the last play
 * finishes the game, and a finished game stays finished.
 */
export function useKeepWatchProgress(
  gameId: string | null,
  plays: Play[],
  stored: WatchProgress | null,
  revealedId: string | null,
  over: boolean,
): string | null {
  const storedId = stored?.playId ?? null;
  const storedFinished = stored?.finished ?? false;
  const placeIndex = Math.max(
    plays.findIndex((play) => play.id === storedId),
    plays.findIndex((play) => play.id === revealedId),
  );
  const place = plays[placeIndex] ?? null;
  const finished =
    storedFinished ||
    (over && place !== null && placeIndex === plays.length - 1);

  const unsaved =
    place !== null && (place.id !== storedId || finished !== storedFinished);
  useEffect(() => {
    if (gameId === null || !unsaved) return;
    recordWatchProgress(gameId, {
      playId: place.id,
      finished,
    });
  }, [gameId, unsaved, place, finished]);

  return place?.id ?? null;
}
