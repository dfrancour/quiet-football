"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { recapDatasetQuery } from "~/lib/queries";
import { recapsFromDataset } from "~/lib/recap-dataset";
import { type RecapsFile } from "~/lib/recaps";
import { type SeasonFile } from "~/lib/season.schema";
import { type TeamRegistry } from "~/lib/teams.schema";

/** How often a game waiting on its recap re-reads the season's recaps. */
export const RECAPS_POLL_MS = 2 * 60_000;

/** How long after kickoff a game is still waited on. */
const WAIT_MS = 3 * 24 * 60 * 60_000;

interface Watched {
  gameId: string;
  status: string;
  kickoff: string;
}

/**
 * A season's recap links from football-recaps-data, keyed by game. Read once,
 * and while the selected game is final, recent and still unlinked, every two
 * minutes.
 */
export function useRecaps(
  season: SeasonFile,
  registry: TeamRegistry,
  selected: Watched | null,
): RecapsFile {
  const { data } = useQuery({
    ...recapDatasetQuery(season.season),
    staleTime: RECAPS_POLL_MS,
    refetchInterval: (query) => {
      const recaps = query.state.data;
      const waiting =
        selected !== null &&
        selected.status === "final" &&
        Date.now() - Date.parse(selected.kickoff) < WAIT_MS &&
        !(
          recaps && recapsFromDataset(recaps, season, registry)[selected.gameId]
        );
      return waiting ? RECAPS_POLL_MS : false;
    },
  });

  return useMemo(
    () => ({
      season: season.season,
      recaps: data ? recapsFromDataset(data, season, registry) : {},
    }),
    [data, season, registry],
  );
}
