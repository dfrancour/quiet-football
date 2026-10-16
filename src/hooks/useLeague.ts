"use client";

import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { type PlayoffMarks } from "~/lib/playoff-marks.schema";
import {
  playoffMarksQuery,
  seasonYearQuery,
  teamsQuery,
  weekQueries,
} from "~/lib/queries";
import { regularSeasonWeeks } from "~/lib/season-calendar";
import { seasonFromWeeks, type WeekBoard } from "~/lib/season-sync";
import { type SeasonFile } from "~/lib/season.schema";
import { type TeamRegistry } from "~/lib/teams.schema";

export interface LoadedWeek extends WeekBoard {
  /** When its scoreboard last arrived. */
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

interface WeeksSoFar {
  weeks: LoadedWeek[] | null;
  error: Error | null;
}

/** Module-level, so the result is kept until a week's query changes. */
function combineWeeks(results: UseQueryResult<WeekBoard>[]): WeeksSoFar {
  const failed = results.find((result) => result.isError && !result.data);
  if (failed) return { weeks: null, error: failed.error };
  if (results.some((result) => !result.data)) {
    return { weeks: null, error: null };
  }
  return {
    weeks: results.flatMap((result) =>
      result.data
        ? [
            {
              ...result.data,
              updatedAt: result.dataUpdatedAt,
              error: result.error,
            },
          ]
        : [],
    ),
    error: null,
  };
}

/**
 * The season the app shows, every week of it fetched together; null until
 * all have arrived. Each week keeps itself current on its own terms
 * (`weekQuery`), so a game under way reaches every page reading this.
 */
export function useSeason(): Loading<SeasonData> {
  const year = useQuery(seasonYearQuery());
  const season = year.data ?? null;
  const { weeks, error } = useQueries({
    queries:
      season === null ? [] : weekQueries(season, regularSeasonWeeks(season)),
    combine: combineWeeks,
  });

  const data = useMemo(
    () =>
      season === null || weeks === null
        ? null
        : {
            season: seasonFromWeeks(season, weeks),
            weeks: new Map(weeks.map((week) => [week.week, week])),
          },
    [season, weeks],
  );

  return { data, error: year.error ?? error };
}

/** ESPN's playoff seeds and clinch codes; null until they arrive. */
export function usePlayoffMarks(season: number | null): PlayoffMarks | null {
  const { data } = useQuery({
    ...playoffMarksQuery(season ?? 0),
    enabled: season !== null,
  });
  return data ?? null;
}
