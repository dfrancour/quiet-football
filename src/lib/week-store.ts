import { z } from "zod";
import { scoreboardSchema } from "~/lib/score.schema";
import { teamRegistrySchema, type TeamRegistry } from "~/lib/teams.schema";

/**
 * What a visit leaves for the next, in `localStorage`, so only what can
 * still change is asked of ESPN again. A week every game of which is final
 * or canceled cannot change, so its scoreboard stands in for ESPN for good;
 * a week still ahead is kept with the time it arrived and stands in until
 * it is older than the query trusts (`aheadStaleMs`). Trimmed to the
 * schema's fields a week is about 11 KB, a season under 250 KB. The team
 * registry, which a season does not change, is kept the same way.
 */

/** Bumped when a schema gains a field a saved copy would lack. */
const FORMAT = 2;

export const WEEK_PREFIX = "scoreboard:";
export const TEAMS_PREFIX = "teams:";

const savedWeekSchema = z.object({
  format: z.literal(FORMAT),
  /** When it arrived from ESPN. */
  savedAt: z.number(),
  payload: scoreboardSchema,
});

const savedTeamsSchema = z.object({
  format: z.literal(FORMAT),
  savedAt: z.number(),
  registry: teamRegistrySchema,
});

export interface SavedTeams {
  registry: TeamRegistry;
  savedAt: number;
}

export interface SavedWeek {
  payload: unknown;
  savedAt: number;
}

function weekKey(season: number, week: number): string {
  return `${WEEK_PREFIX}${season}:${week}`;
}

function teamsKey(season: number): string {
  return `${TEAMS_PREFIX}${season}`;
}

/** A saved value, or null; a copy that cannot be read is dropped. */
function read<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw) as unknown);
    if (parsed.success) return parsed.data;
    window.localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves under a season, letting go of other seasons' first so storage holds
 * one season at most. Blocked or full storage is left alone: the value is
 * simply fetched next time.
 */
function save(prefix: string, season: number, key: string, value: unknown) {
  try {
    const mine = `${prefix}${season}`;
    for (const stored of Object.keys(window.localStorage)) {
      if (
        stored.startsWith(prefix) &&
        stored !== mine &&
        !stored.startsWith(`${mine}:`)
      ) {
        window.localStorage.removeItem(stored);
      }
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** The week's scoreboard as saved, with when, or null. */
export function savedWeek(season: number, week: number): SavedWeek | null {
  const saved = read(weekKey(season, week), savedWeekSchema);
  return saved ? { payload: saved.payload, savedAt: saved.savedAt } : null;
}

export function saveWeek(
  season: number,
  week: number,
  payload: unknown,
  savedAt: number,
): void {
  save(WEEK_PREFIX, season, weekKey(season, week), {
    format: FORMAT,
    savedAt,
    payload,
  });
}

/** The season's team registry as saved, with when, or null. */
export function savedTeams(season: number): SavedTeams | null {
  const saved = read(teamsKey(season), savedTeamsSchema);
  return saved ? { registry: saved.registry, savedAt: saved.savedAt } : null;
}

export function saveTeams(
  season: number,
  registry: TeamRegistry,
  savedAt: number,
): void {
  save(TEAMS_PREFIX, season, teamsKey(season), {
    format: FORMAT,
    savedAt,
    registry,
  });
}
