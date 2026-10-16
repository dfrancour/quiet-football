import { type LiveScore } from "~/lib/score.schema";

/** A live game's own clock, as a scoreboard poll gave it. */
export type GameClock = Pick<
  LiveScore,
  "detail" | "period" | "clock" | "completed"
>;

/** Longer than the longest broadcast delay, so its moment is always held. */
const KEEP_MS = 2 * 60 * 1000;

/**
 * Each game's clock as the scoreboard polls gave it, kept a couple of
 * minutes, so a viewer's delayed broadcast can be shown its own moment.
 */
const history = new Map<string, { at: number; clock: GameClock }[]>();

export function noteGameClock(
  gameId: string,
  { detail, period, clock, completed }: GameClock,
  at: number,
): void {
  const entries = history.get(gameId) ?? [];
  const last = entries.at(-1)?.clock;
  if (
    last?.detail === detail &&
    last.period === period &&
    last.clock === clock &&
    last.completed === completed
  ) {
    return;
  }
  // The newest entry from before the window still stands for its start.
  const kept = entries.filter(
    (entry, index) => (entries[index + 1]?.at ?? at) > at - KEEP_MS,
  );
  history.set(gameId, [
    ...kept,
    { at, clock: { detail, period, clock, completed } },
  ]);
}

/**
 * The clock as it stood at `at`: the latest noted by then, or the earliest
 * there is if the page has not been open that long. Null if none was noted.
 */
export function gameClockAsOf(gameId: string, at: number): GameClock | null {
  const entries = history.get(gameId) ?? [];
  const asOf = entries.filter((entry) => entry.at <= at).at(-1);
  return asOf?.clock ?? entries[0]?.clock ?? null;
}

/** For tests: forget every clock. */
export function resetGameClocks(): void {
  history.clear();
}
