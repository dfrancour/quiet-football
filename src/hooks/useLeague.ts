"use client";

import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type PlayoffMarks } from "~/lib/playoff-marks.schema";
import {
  playoffMarksQuery,
  teamsQuery,
  weekQueries,
  type LoadedBoard,
} from "~/lib/queries";
import {
  currentSeason,
  regularSeasonWeeks,
  weekName,
} from "~/lib/season-calendar";
import { seasonFromWeeks, type WeekBoard } from "~/lib/season-sync";
import { type SeasonFile } from "~/lib/season.schema";
import { type TeamRegistry } from "~/lib/teams.schema";

export interface LoadedWeek extends WeekBoard {
  /** When its scoreboard last arrived from ESPN. */
  updatedAt: number;
  /** The last poll's failure, with the week as it stood before it. */
  error: Error | null;
}

export interface SeasonData {
  season: SeasonFile;
  weeks: ReadonlyMap<number, LoadedWeek>;
}

export interface Loading<T> {
  data: T | null;
  /** Set once loading has failed; null while loading or loaded. */
  error: Error | null;
}

/** The registry, once the season is known; null until then. */
export function useTeams(season: number | null): Loading<TeamRegistry> {
  const { data, error } = useQuery({
    ...teamsQuery(season ?? 0),
    enabled: season !== null,
  });
  return { data: data ?? null, error };
}

/** A week that could not be read, named for the viewer; `cause` is why. */
export class WeekLoadError extends Error {
  constructor(
    readonly weekName: string,
    readonly cause: Error,
  ) {
    super(`${weekName} could not be loaded`);
    this.name = "WeekLoadError";
  }
}

interface WeeksSoFar {
  weeks: LoadedWeek[] | null;
  /**
   * The week that failed with nothing to show, and why; the week is null
   * when more than one did, since then it is the season that is out.
   */
  failed: { week: number | null; error: Error } | null;
  /** Whether week 1 has arrived with no games: ESPN has no such season. */
  empty: boolean;
}

/** Module-level, so the result is kept until a week's query changes. */
function combineWeeks(results: UseQueryResult<LoadedBoard>[]): WeeksSoFar {
  const empty = results[0]?.data?.games.length === 0;
  const failures = results.filter((result) => result.isError && !result.data);
  const first = failures[0];
  if (first) {
    // A playoff round waits on the week before it, so one failure can be
    // reported by several weeks; it is one week out when all share a cause.
    const causes = new Set(failures.map((result) => result.error));
    return {
      weeks: null,
      failed: {
        week: causes.size === 1 ? results.indexOf(first) + 1 : null,
        error: first.error,
      },
      empty,
    };
  }
  if (results.length === 0 || results.some((result) => !result.data)) {
    return { weeks: null, failed: null, empty };
  }
  return {
    weeks: results.flatMap((result) =>
      result.data
        ? [
            {
              ...result.data,
              updatedAt: result.data.fetchedAt,
              error: result.error,
            },
          ]
        : [],
    ),
    failed: null,
    empty,
  };
}

function nameFailure(
  season: number,
  failed: WeeksSoFar["failed"],
): Error | null {
  if (!failed) return null;
  return failed.week === null
    ? failed.error
    : new WeekLoadError(
        weekName(regularSeasonWeeks(season), failed.week),
        failed.error,
      );
}

/**
 * The season the app shows, every week of it fetched together; null until
 * all have arrived. Each week keeps itself current on its own terms
 * (`weekQuery`), so a game under way reaches every page reading this.
 *
 * The current season's weeks go out at once, with nothing waited on first.
 * Between March and the schedule's release in May ESPN has no games for it,
 * which its week 1 says, and the season before is read instead.
 */
export function useSeason(): Loading<SeasonData> {
  const [current] = useState(() => currentSeason(Date.now()));
  const thisYear = useQueries({
    queries: weekQueries(current, regularSeasonWeeks(current)),
    combine: combineWeeks,
  });
  const fallBack = thisYear.empty;
  const lastYear = useQueries({
    queries: fallBack
      ? weekQueries(current - 1, regularSeasonWeeks(current - 1))
      : [],
    combine: combineWeeks,
  });

  const season = fallBack ? current - 1 : current;
  const { weeks, failed, empty } = fallBack ? lastYear : thisYear;
  const error = useMemo(
    () =>
      fallBack && empty
        ? new Error(`ESPN has no schedule for ${current} or ${current - 1}`)
        : nameFailure(season, failed),
    [fallBack, empty, current, season, failed],
  );

  const data = useMemo(
    () =>
      weeks === null || error
        ? null
        : {
            season: seasonFromWeeks(season, weeks),
            weeks: new Map(weeks.map((week) => [week.week, week])),
          },
    [season, weeks, error],
  );

  return { data, error };
}

/**
 * ESPN's playoff seeds and clinch codes; null until they arrive. Read only
 * while `wanted`: a page that cannot show them asks for nothing.
 */
export function usePlayoffMarks(
  season: number,
  wanted: boolean,
): PlayoffMarks | null {
  const { data } = useQuery({
    ...playoffMarksQuery(season),
    enabled: wanted,
  });
  return data ?? null;
}
