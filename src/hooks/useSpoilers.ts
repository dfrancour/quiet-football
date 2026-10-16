"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useWatchProgressByGame } from "~/hooks/useWatchProgress";
import { isGateOpen, type GateGame } from "~/lib/playoffs";
import { teamRecord, type TeamRecord } from "~/lib/schedule";
import {
  catchUpThrough,
  getCaughtUp,
  getServerCaughtUp,
  recordsShownBefore,
  subscribeToCaughtUp,
} from "~/lib/spoilers";
import { type TeamGame } from "~/lib/team-view";

export interface CaughtUpState {
  season: number;
  totalWeeks: number;
  /** The last week every game is settled through: as far as catching up goes. */
  settledThrough: number;
  /** The week the league is on (`currentWeek()`). */
  currentWeek: number;
}

/**
 * Where the viewer is in the season, from the browser, and the games seen
 * to the end beyond it.
 */
export function useSpoilers({
  season,
  totalWeeks,
  settledThrough,
  currentWeek,
}: CaughtUpState) {
  const caughtUp = useSyncExternalStore(
    subscribeToCaughtUp,
    getCaughtUp,
    getServerCaughtUp,
  );
  /** The last week the viewer is caught up through; 0 for none. */
  const through = caughtUp[String(season)] ?? 0;

  /** Caught up through this week of the season, or none; other seasons keep theirs. */
  const catchUp = useCallback(
    (week: number) => catchUpThrough(season, week),
    [season],
  );

  const progress = useWatchProgressByGame();

  /**
   * The viewer is caught up through its week, or saw it to the end: watched,
   * followed live or uncovered.
   */
  const isShown = useCallback(
    (game: GateGame) =>
      game.week <= through || progress[game.gameId]?.finished === true,
    [through, progress],
  );

  /** A playoff matchup may be shown: every game deciding it is seen. */
  const isOpen = useCallback(
    (gate: readonly GateGame[]) => isGateOpen(gate, isShown),
    [isShown],
  );

  /** The records going into a game in this week give nothing unseen away. */
  const showsRecordsBefore = useCallback(
    (week: number) => recordsShownBefore(week, through, totalWeeks),
    [through, totalWeeks],
  );

  /** A team's record through the viewer's week; null through none. */
  const recordThrough = useCallback(
    (games: readonly TeamGame[]): TeamRecord | null =>
      through === 0
        ? null
        : teamRecord(games.filter((game) => game.week <= through)),
    [through],
  );

  return useMemo(
    () => ({
      through,
      settledThrough,
      currentWeek,
      totalWeeks,
      catchUp,
      isShown,
      isOpen,
      showsRecordsBefore,
      recordThrough,
    }),
    [
      through,
      settledThrough,
      currentWeek,
      totalWeeks,
      catchUp,
      isShown,
      isOpen,
      showsRecordsBefore,
      recordThrough,
    ],
  );
}
