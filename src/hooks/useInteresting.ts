"use client";

import { useQueries } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import {
  getMarkInteresting,
  getServerMarkInteresting,
  isInteresting,
  subscribeToMarkInteresting,
} from "~/lib/interesting";
import { swingsQuery } from "~/lib/queries";

/** Whether the viewer asked to have interesting games marked. */
export function useMarkInteresting(): boolean {
  return useSyncExternalStore(
    subscribeToMarkInteresting,
    getMarkInteresting,
    getServerMarkInteresting,
  );
}

const NONE: ReadonlySet<string> = new Set();

/**
 * Of the finished games a page draws, the ones worth watching, while the
 * viewer has marks on. Off, nothing is asked of ESPN; on, each game's win
 * probability is asked for once, and only for the games given.
 */
export function useInterestingGames(
  season: number,
  finishedGameIds: readonly string[],
): ReadonlySet<string> {
  const marked = useMarkInteresting();
  const ids = marked ? finishedGameIds : [];
  const found = useQueries({
    queries: ids.map((gameId) => swingsQuery(season, gameId)),
    combine: (results) =>
      ids
        .filter((_, index) => {
          const swings = results[index]?.data;
          return swings !== undefined && isInteresting(swings);
        })
        .join(),
  });
  return useMemo(
    () => (found === "" ? NONE : new Set(found.split(","))),
    [found],
  );
}
