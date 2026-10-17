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
import { finishGames } from "~/lib/watch-progress";
import { type WeekInProgress } from "~/lib/week";

export interface CaughtUpState {
  season: number;
  totalWeeks: number;
  /** The last week every game is settled through: as far as catching up goes. */
  settledThrough: number;
  /** The week the league is on (`currentWeek()`). */
  currentWeek: number;
  /** The week after `settledThrough` once a game in it is over (`weekInProgress()`). */
  inProgress: WeekInProgress | null;
}

/** A week in progress as the strip offers it: half a week, taken or not. */
export interface PartialWeek {
  week: number;
  /** Every game in it that is over has been seen. */
  uncovered: boolean;
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
  inProgress,
}: CaughtUpState) {
  const caughtUp = useSyncExternalStore(
    subscribeToCaughtUp,
    getCaughtUp,
    getServerCaughtUp,
  );
  /** The last week the viewer is caught up through; 0 for none. */
  const through = caughtUp[String(season)] ?? 0;

  const progress = useWatchProgressByGame();

  /**
   * The week in progress, and whether its finished games are all seen; null
   * while none of its games is over.
   */
  const partial = useMemo<PartialWeek | null>(
    () =>
      inProgress && {
        week: inProgress.week,
        uncovered: inProgress.finalGameIds.every(
          (gameId) => progress[gameId]?.finished === true,
        ),
      },
    [inProgress, progress],
  );

  /**
   * Caught up through this week of the season, or none; other seasons keep
   * theirs. The week in progress catches up through every settled week and
   * takes its finished games as seen, which stays so: a game seen to the end
   * is never unseen.
   */
  const catchUp = useCallback(
    (week: number) => {
      if (inProgress && week === inProgress.week) {
        catchUpThrough(season, Math.max(through, settledThrough));
        finishGames(inProgress.finalGameIds);
      } else {
        catchUpThrough(season, week);
      }
    },
    [season, through, settledThrough, inProgress],
  );

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
      partial,
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
      partial,
      catchUp,
      isShown,
      isOpen,
      showsRecordsBefore,
      recordThrough,
    ],
  );
}
