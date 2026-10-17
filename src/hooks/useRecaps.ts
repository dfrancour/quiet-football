"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { scoreConfig } from "~/lib/config";
import { recapDatasetQuery } from "~/lib/queries";
import { recapsFromDataset } from "~/lib/recap-dataset";
import { type RecapsFile } from "~/lib/recaps";
import { type SeasonFile } from "~/lib/season.schema";
import { type TeamRegistry } from "~/lib/teams.schema";

export const RECAPS_STALE_MS = scoreConfig.recapsStaleMs;

/** How long after kickoff a game is still waited on. */
const WAIT_MS = 3 * 24 * 60 * 60_000;

interface Watched {
  gameId: string;
  status: string;
  kickoff: string;
}

/**
 * A season's recap links from football-recaps-data, keyed by game. Read
 * once a visit. The dataset is built and pushed by a person on no schedule,
 * so nothing is polled: the only reason to look again is the viewer
 * selecting a recent final game that still has no recap, and then only if
 * the copy in hand is over an hour old.
 */
export function useRecaps(
  season: SeasonFile,
  registry: TeamRegistry,
  selected: Watched | null,
): RecapsFile {
  const { data, dataUpdatedAt, refetch } = useQuery({
    ...recapDatasetQuery(season.season),
    staleTime: Infinity,
  });

  const recaps = useMemo(
    () => (data ? recapsFromDataset(data, season, registry) : {}),
    [data, season, registry],
  );

  // Looked again when the viewer turns to a game, not as time passes.
  const gameId = selected?.gameId ?? null;
  const status = selected?.status ?? null;
  const kickoff = selected?.kickoff ?? null;
  useEffect(() => {
    if (gameId === null || status !== "final" || kickoff === null || !data) {
      return;
    }
    const now = Date.now();
    const waiting = now - Date.parse(kickoff) < WAIT_MS && !recaps[gameId];
    if (waiting && now - dataUpdatedAt >= RECAPS_STALE_MS) void refetch();
  }, [gameId, status, kickoff, data, recaps, dataUpdatedAt, refetch]);

  return useMemo(() => ({ season: season.season, recaps }), [season, recaps]);
}
