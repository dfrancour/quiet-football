import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";
import { fetchUpstream } from "~/lib/upstream";

/**
 * Which finished games were worth watching, from ESPN's win probability:
 * its chance of the home side winning after every play. A game whose
 * chances swung back and forth all afternoon moves it a long way; a rout
 * barely at all. Nothing here is odds or a line: only how much the game
 * turned, and how far the side that won had fallen.
 */

/**
 * ESPN's win probability, one item per play in the order played. ESPN's NFL
 * events each hold one competition, under the event's id.
 */
function probabilitiesUrl(gameId: string): string {
  return `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${gameId}/competitions/${gameId}/probabilities?limit=1000`;
}

const probabilitiesSchema = z.object({
  items: z.array(z.object({ homeWinPercentage: z.number().min(0).max(1) })),
});

/** How a game turned, as far as the mark reads it. */
export interface GameSwings {
  /**
   * Every change in the home side's chance, added up: 1 is one side going
   * from certain loss to certain win. A rout reads about 1, an ordinary
   * game 3 or 4, a classic 7 or more.
   */
  swing: number;
  /** The lowest the winner's chance fell; null for a tie or no feed. */
  winnerLow: number | null;
  /**
   * The feed reaches the end: the game is settled in it, a side certain or
   * a tie even. Until then it may still be catching up with the final plays.
   */
  complete: boolean;
}

/** Above this, a game turned enough to be worth watching. */
const SWING_INTERESTING = 5;
/** At or below this, the winner was all but beaten: a comeback. */
const COMEBACK_LOW = 0.05;

/** How a game turned, from the home side's chance after each play. */
export function swingsOf(homeChances: readonly number[]): GameSwings {
  const last = homeChances.at(-1);
  if (last === undefined) return { swing: 0, winnerLow: null, complete: true };
  let swing = 0;
  for (let index = 1; index < homeChances.length; index += 1) {
    swing += Math.abs(
      (homeChances[index] ?? 0) - (homeChances[index - 1] ?? 0),
    );
  }
  const winner = last > 0.5 ? "home" : last < 0.5 ? "away" : null;
  return {
    swing,
    winnerLow:
      winner === null
        ? null
        : Math.min(
            ...homeChances.map((chance) =>
              winner === "home" ? chance : 1 - chance,
            ),
          ),
    complete: last === 0 || last === 1 || last === 0.5,
  };
}

/**
 * Worth watching: it turned and turned again, or the winner came back from
 * all but beaten. About a quarter of a season's games, four a week.
 */
export function isInteresting({ swing, winnerLow }: GameSwings): boolean {
  return (
    swing >= SWING_INTERESTING ||
    (winnerLow !== null && winnerLow <= COMEBACK_LOW)
  );
}

/** A game's swings, from ESPN's win probability. */
export async function fetchSwings(
  gameId: string,
  signal?: AbortSignal,
): Promise<GameSwings> {
  const { items } = probabilitiesSchema.parse(
    await fetchUpstream(probabilitiesUrl(gameId), signal),
  );
  return swingsOf(items.map((item) => item.homeWinPercentage));
}

/**
 * Whether the viewer asked to have interesting games marked. A mark says a
 * finished game was close or turned, and its absence that it was not, so
 * it is off until asked for. Not per season.
 */
const markStore = createLocalStore<boolean>(
  "interesting-marked",
  z.boolean(),
  false,
);

export const subscribeToMarkInteresting = markStore.subscribe;
export const getMarkInteresting = markStore.get;
export const getServerMarkInteresting = markStore.getServer;
export const resetMarkInterestingCache = markStore.resetCache;

export function setMarkInteresting(on: boolean): void {
  if (markStore.get() !== on) markStore.set(on);
}
