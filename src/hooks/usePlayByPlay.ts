"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { playByPlayQuery } from "~/lib/queries";
import { type PlayByPlay } from "~/lib/plays.schema";

/**
 * A game's drives and plays. A null game fetches nothing; `live` polls them.
 * Once the game is no longer live, a summary that did not yet call it over
 * is read once more, since the last plays may have landed after the last
 * poll.
 */
export function usePlayByPlay(
  gameId: string | null,
  live: boolean,
): PlayByPlay | null {
  const { data, refetch } = useQuery({
    ...playByPlayQuery(gameId ?? "", live),
    enabled: gameId !== null,
  });
  const final = data?.final ?? true;
  useEffect(() => {
    if (!live && !final) void refetch();
  }, [live, final, refetch]);
  return data ?? null;
}
