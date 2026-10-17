import { z } from "zod";

/** How long each stage of a replayed play takes at 1×. */
export interface ReplayTiming {
  /** A snap lined up. */
  lineUpMs: number;
  /** One draw animation; the stylesheet reads it as `--field-draw`. */
  drawMs: number;
  /** A drawn result at rest. */
  holdMs: number;
}

export const DEFAULT_TIMING: ReplayTiming = {
  lineUpMs: 3_000,
  drawMs: 1_000,
  holdMs: 300,
};

const STORAGE_KEY = "replay-timing";
const PARAM = "timing";

const timingSchema = z.object({
  lineUpMs: z.number().int().nonnegative(),
  drawMs: z.number().int().positive(),
  holdMs: z.number().int().nonnegative(),
});

/** `lineUp,draw,hold` in milliseconds; anything else is no override. */
export function parseTiming(value: string): ReplayTiming | null {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3) return null;
  const [lineUpMs, drawMs, holdMs] = parts;
  const parsed = timingSchema.safeParse({ lineUpMs, drawMs, holdMs });
  return parsed.success ? parsed.data : null;
}

/**
 * The override in development: `?timing=lineUp,draw,hold` sets it and keeps
 * it in the browser for the pages after; `?timing=` lets it go. Read once
 * per page load. The build has none and runs at the defaults.
 */
function readOverride(): ReplayTiming | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (typeof window === "undefined") return null;
  try {
    const param = new URLSearchParams(window.location.search).get(PARAM);
    if (param !== null) {
      const timing = parseTiming(param);
      if (timing)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timing));
      else window.localStorage.removeItem(STORAGE_KEY);
      return timing;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = timingSchema.safeParse(JSON.parse(stored) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

let current: ReplayTiming | null = null;

export function replayTiming(): ReplayTiming {
  if (current) return current;
  const override = readOverride();
  if (override) {
    console.info(
      `Replay timing: lined up ${override.lineUpMs}ms, draw ${override.drawMs}ms, hold ${override.holdMs}ms (?timing= to clear)`,
    );
  }
  current = override ?? DEFAULT_TIMING;
  return current;
}
