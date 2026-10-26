"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getBroadcastDelays,
  getServerBroadcastDelays,
  subscribeToBroadcastDelays,
} from "~/lib/broadcast-delay";
import { subscribeToNothing } from "~/hooks/useBrowserValue";
import { getClockSnapshot, subscribeToClock } from "~/lib/clock";
import { gameClockAsOf, type GameClock } from "~/lib/game-clocks";
import { lastArrivedBy } from "~/lib/play-arrivals";
import { drivesThrough, playsInOrder } from "~/lib/plays";
import { type Drive } from "~/lib/plays.schema";

/** How far, in milliseconds, the viewer holds this game back. */
export function useBroadcastDelay(gameId: string | null): number {
  const delays = useSyncExternalStore(
    subscribeToBroadcastDelays,
    getBroadcastDelays,
    getServerBroadcastDelays,
  );
  return (delays[gameId ?? ""] ?? 0) * 1000;
}

/**
 * The game's own clock as the viewer's delayed broadcast has it. Undefined
 * without a delay, for the caller to use the live one.
 */
export function useBroadcastClock(
  gameId: string | null,
  delayMs: number,
): GameClock | null | undefined {
  const delayed = gameId !== null && delayMs > 0;
  return useSyncExternalStore(
    delayed ? subscribeToClock : subscribeToNothing,
    () => {
      if (!delayed) return undefined;
      const now = getClockSnapshot();
      return now === null ? null : gameClockAsOf(gameId, now - delayMs);
    },
    () => undefined,
  );
}

/**
 * A live game's drives as the viewer's delayed broadcast has them: each play
 * from its arrival plus the delay. Nothing already seen (`seenId`) is held
 * back again, so lengthening the delay mid-game only waits.
 */
export function useBroadcastDrives(
  drives: Drive[] | null,
  delayMs: number,
  ongoing: boolean,
  seenId: string | null,
): Drive[] | null {
  const plays = useMemo(() => playsInOrder(drives ?? []), [drives]);
  const delayed = drives !== null && ongoing && delayMs > 0;
  const arrivedId = useSyncExternalStore(
    delayed ? subscribeToClock : subscribeToNothing,
    () => {
      const now = getClockSnapshot();
      return delayed && now !== null
        ? lastArrivedBy(plays, now - delayMs)
        : null;
    },
    () => null,
  );
  return useMemo(() => {
    if (!delayed) return drives;
    const cut =
      plays[
        Math.max(
          plays.findIndex((play) => play.id === arrivedId),
          plays.findIndex((play) => play.id === seenId),
        )
      ];
    return cut ? drivesThrough(drives, cut.id) : [];
  }, [delayed, drives, plays, arrivedId, seenId]);
}
