import { z } from "zod";
import { scoreboardSchema } from "~/lib/score.schema";

/**
 * A week every game of which is final or canceled cannot change, so its
 * scoreboard is saved in `localStorage` and stands in for ESPN on the next
 * visit; only weeks still in play are fetched again. Trimmed to the schema's
 * fields a week is about 11 KB, a season under 250 KB.
 */

/** Bumped when the scoreboard schema gains a field a saved week would lack. */
const FORMAT = 1;

const PREFIX = "scoreboard:";

const savedSchema = z.object({
  format: z.literal(FORMAT),
  payload: scoreboardSchema,
});

function key(season: number, week: number): string {
  return `${PREFIX}${season}:${week}`;
}

/** The week's scoreboard as saved, or null; a copy that cannot be read is dropped. */
export function savedWeek(season: number, week: number): unknown | null {
  try {
    const raw = window.localStorage.getItem(key(season, week));
    if (raw === null) return null;
    const parsed = savedSchema.safeParse(JSON.parse(raw) as unknown);
    if (parsed.success) return parsed.data.payload;
    window.localStorage.removeItem(key(season, week));
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves a settled week's scoreboard, letting go of other seasons' first so
 * storage holds one season at most. Blocked or full storage is left alone:
 * the week is simply fetched next time.
 */
export function saveWeek(season: number, week: number, payload: unknown): void {
  try {
    const mine = `${PREFIX}${season}:`;
    for (const stored of Object.keys(window.localStorage)) {
      if (stored.startsWith(PREFIX) && !stored.startsWith(mine)) {
        window.localStorage.removeItem(stored);
      }
    }
    window.localStorage.setItem(
      key(season, week),
      JSON.stringify({ format: FORMAT, payload }),
    );
  } catch {}
}
