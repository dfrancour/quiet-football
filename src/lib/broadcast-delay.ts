import { z } from "zod";
import { type GameClock } from "~/lib/game-clocks";
import { createLocalStore } from "~/lib/local-store";
import { type GamePhase } from "~/lib/schedule";

/**
 * Seconds a viewer can hold a live game back, to match a radio or TV
 * broadcast that runs behind the data.
 */
export const BROADCAST_DELAYS = [0, 10, 20, 30, 45, 60] as const;

/**
 * By game, seconds its live plays and clock are held back. A game it does
 * not name has none. It says nothing about any result, so it does not expire.
 */
export type BroadcastDelays = Readonly<Record<string, number>>;

const store = createLocalStore<BroadcastDelays>(
  "broadcast-delay",
  z.record(z.string(), z.number().int().nonnegative()),
  {},
);

export const subscribeToBroadcastDelays = store.subscribe;
export const getBroadcastDelays = store.get;
export const getServerBroadcastDelays = store.getServer;
export const resetBroadcastDelaysCache = store.resetCache;

/** The next delay along, back to none after the longest. */
export function nextBroadcastDelay(seconds: number): number {
  const current = BROADCAST_DELAYS.indexOf(
    seconds as (typeof BROADCAST_DELAYS)[number],
  );
  return BROADCAST_DELAYS[(current + 1) % BROADCAST_DELAYS.length] ?? 0;
}

export function cycleBroadcastDelay(gameId: string): void {
  const delays = store.get();
  const next = nextBroadcastDelay(delays[gameId] ?? 0);
  const others = Object.entries(delays).filter(([id]) => id !== gameId);
  store.set(
    Object.fromEntries(next > 0 ? [...others, [gameId, next]] : others),
  );
}

/**
 * A game the store calls over still plays on for a viewer whose delayed
 * broadcast has not reached the end. `clock` is the delayed one: undefined
 * without a delay.
 */
export function broadcastPhase(
  phase: GamePhase,
  clock: GameClock | null | undefined,
): GamePhase {
  return phase === "final" && clock != null && !clock.completed
    ? "live"
    : phase;
}
