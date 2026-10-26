"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { scoreConfig } from "~/lib/config";
import { gameSettledAt } from "~/lib/game-clocks";
import { recapDatasetQuery } from "~/lib/queries";
import { hasRecap, recapsFromDataset } from "~/lib/recap-dataset";
import { type RecapsFile } from "~/lib/recaps";
import { type GameStatus, type SeasonFile } from "~/lib/season.schema";
import { type TeamRegistry } from "~/lib/teams.schema";

/**
 * How often to look for a game's recap, by how long ago it went final:
 * often at first, then less, then never (`scoreConfig.recapsPoll`).
 */
export function recapsPollMs(sinceFinalMs: number): number | false {
  const hours = Math.max(0, sinceFinalMs) / (60 * 60_000);
  return (
    scoreConfig.recapsPoll.find((step) => hours < step.untilHours)?.everyMs ??
    false
  );
}

/**
 * When a final game ended: the moment a poll saw it go final this visit, or
 * for one already over when first seen, a typical game after kickoff.
 */
export function gameEndedAt(gameId: string, kickoff: string): number {
  return (
    gameSettledAt(gameId) ?? Date.parse(kickoff) + scoreConfig.typicalGameMs
  );
}

interface Watched {
  gameId: string;
  status: GameStatus;
  kickoff: string;
}

/**
 * A season's recap links from football-recaps-data, keyed by game. Read
 * once a visit, and while the selected game is final and still unlinked,
 * read again on `recapsPollMs`'s schedule from when the game ended: the NFL
 * posts a recap soon after and the dataset is updated often, so the first
 * hours are watched closely and the window closes after a few days. A game
 * under way, an old one, or the offseason asks nothing.
 */
export function useRecaps(
  season: SeasonFile,
  registry: TeamRegistry,
  selected: Watched | null,
): RecapsFile {
  const { data } = useQuery({
    ...recapDatasetQuery(season.season),
    refetchInterval: (query) => {
      if (selected === null || selected.status !== "final") return false;
      const dataset = query.state.data;
      if (dataset && hasRecap(dataset, season, registry, selected.gameId)) {
        return false;
      }
      return recapsPollMs(
        Date.now() - gameEndedAt(selected.gameId, selected.kickoff),
      );
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
