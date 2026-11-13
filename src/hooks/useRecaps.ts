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
 * A season's recap links from football-recaps-data, keyed by game, for the
 * games a page draws a recap beside: a team page's selected game, or the
 * finished games of the league's shown week. Read once a visit, and only
 * once one of them is final; while one is final and still unlinked, read
 * again on `recapsPollMs`'s schedule from when it ended, the soonest any of
 * them asks: the NFL posts a recap soon after and the dataset is updated
 * often, so the first hours are watched closely and the window closes after
 * a few days. A game under way, an old one, or the offseason asks nothing.
 */
export function useRecaps(
  season: SeasonFile,
  registry: TeamRegistry,
  watched: readonly Watched[],
): RecapsFile {
  const finals = watched.filter((game) => game.status === "final");
  const { data } = useQuery({
    ...recapDatasetQuery(season.season),
    enabled: finals.length > 0,
    refetchInterval: (query) => {
      const dataset = query.state.data;
      const waits = finals
        .filter(
          (game) =>
            !dataset || !hasRecap(dataset, season, registry, game.gameId),
        )
        .map((game) =>
          recapsPollMs(Date.now() - gameEndedAt(game.gameId, game.kickoff)),
        )
        .filter((wait) => wait !== false);
      return waits.length > 0 ? Math.min(...waits) : false;
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
