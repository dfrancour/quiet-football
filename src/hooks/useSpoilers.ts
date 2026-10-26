"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useWatchProgressByGame } from "~/hooks/useWatchProgress";
import { isGateOpen, type GateGame } from "~/lib/playoffs";
import { teamRecord, type TeamRecord } from "~/lib/schedule";
import {
  catchUpThrough,
  getCaughtUp,
  getServerCaughtUp,
  getServerShowAll,
  getShowAll,
  recordsShown,
  setShowAll,
  subscribeToCaughtUp,
  subscribeToShowAll,
  type RecordsShown,
} from "~/lib/spoilers";
import { type GameStatus } from "~/lib/season.schema";
import { type TeamGame } from "~/lib/team-view";
import { clearWatchProgress, finishGames } from "~/lib/watch-progress";
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
 * to the end beyond it. Showing everything overrides both without touching
 * them: every result is shown, and turning it off leaves the viewer where
 * they were.
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
  const showAll = useSyncExternalStore(
    subscribeToShowAll,
    getShowAll,
    getServerShowAll,
  );

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
   * takes its finished games as seen, which stays so while going back: a
   * game seen to the end is never unseen. Hiding everything is the one
   * exception: it drops every game's place too, so nothing partly or wholly
   * watched stays revealed. Picking a week is asking to see only that far,
   * so it stops showing everything.
   */
  const catchUp = useCallback(
    (week: number) => {
      setShowAll(false);
      if (week === 0) {
        catchUpThrough(season, 0);
        clearWatchProgress();
      } else if (inProgress && week === inProgress.week) {
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
      showAll ||
      game.week <= through ||
      progress[game.gameId]?.finished === true,
    [showAll, through, progress],
  );

  /**
   * A live game the viewer is caught up with: their place is the newest play
   * the scoreboard has (`lastPlayId`), so its score tells them nothing new.
   */
  const isCaughtUpLive = useCallback(
    (gameId: string, lastPlayId: string | null) =>
      lastPlayId !== null && progress[gameId]?.playId === lastPlayId,
    [progress],
  );

  /** A playoff matchup may be shown: every game deciding it is seen. */
  const isOpen = useCallback(
    (gate: readonly GateGame[]) => isGateOpen(gate, isShown),
    [isShown],
  );

  /** The records a game may show beside its teams (`recordsShown()`). */
  const recordsAt = useCallback(
    (game: GateGame & { status: GameStatus }): RecordsShown =>
      showAll
        ? { at: game.status === "final" ? "after" : "before" }
        : recordsShown(game, isShown(game), through, totalWeeks),
    [showAll, isShown, through, totalWeeks],
  );

  /** A team's record through the viewer's week; null through none. */
  const recordThrough = useCallback(
    (games: readonly TeamGame[]): TeamRecord | null =>
      showAll
        ? teamRecord(games)
        : through === 0
          ? null
          : teamRecord(games.filter((game) => game.week <= through)),
    [showAll, through],
  );

  /** The last week the standings count; every week while showing all. */
  const standingsThrough = showAll ? Number.POSITIVE_INFINITY : through;
  /** ESPN's seeds and clinch codes describe the present: the whole regular season. */
  const marksShown = showAll || through >= totalWeeks;

  return useMemo(
    () => ({
      through,
      showAll,
      setShowAll,
      standingsThrough,
      marksShown,
      settledThrough,
      currentWeek,
      totalWeeks,
      partial,
      catchUp,
      isShown,
      isCaughtUpLive,
      isOpen,
      recordsAt,
      recordThrough,
    }),
    [
      through,
      showAll,
      standingsThrough,
      marksShown,
      settledThrough,
      currentWeek,
      totalWeeks,
      partial,
      catchUp,
      isShown,
      isCaughtUpLive,
      isOpen,
      recordsAt,
      recordThrough,
    ],
  );
}
