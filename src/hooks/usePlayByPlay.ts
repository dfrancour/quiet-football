"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { playByPlayQuery } from "~/lib/queries";
import { type PlayByPlay } from "~/lib/plays.schema";

/**
 * A game's drives and plays. A null game fetches nothing. While `live`, the
 * summary is read again each time `mark` changes: the scoreboard's word on
 * the game (its clock, score and last play), which the week's poll keeps
 * current, so the summary is asked for only when there is something new in
 * it. Once the game is no longer live, a summary that did not yet call it
 * over is read once more, since the last plays may have landed after the
 * last read.
 */
export function usePlayByPlay(
  gameId: string | null,
  live: boolean,
  mark: string | null = null,
): PlayByPlay | null {
  const { data, refetch } = useQuery({
    ...playByPlayQuery(gameId ?? "", live),
    enabled: gameId !== null,
  });
  const final = data?.final ?? true;
  const loaded = data !== undefined;
  useEffect(() => {
    if (!live && !final) void refetch();
  }, [live, final, refetch]);
  // Only a change of mark is a reason to read again; the first read is the
  // query's own, and a mark seen before it lands is already in it.
  const lastMark = useRef(mark);
  useEffect(() => {
    if (lastMark.current === mark) return;
    lastMark.current = mark;
    if (live && loaded && !final) void refetch();
  }, [mark, live, loaded, final, refetch]);
  return data ?? null;
}
