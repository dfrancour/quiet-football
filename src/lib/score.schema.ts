import { z } from "zod";

/**
 * ESPN reports scores as a bare string on the scoreboard endpoint and as
 * `{ value, displayValue }` on others, so both shapes are accepted.
 */
const rawScoreSchema = z
  .union([
    z.string(),
    z.number(),
    z.object({
      value: z.number().optional(),
      displayValue: z.string().optional(),
    }),
  ])
  .nullish();

const competitorSchema = z.object({
  id: z.union([z.string(), z.number()]).nullish(),
  linescores: z
    .array(
      z.object({ value: z.number().nullish(), period: z.number().nullish() }),
    )
    .nullish(),
  homeAway: z.string().nullish(),
  score: rawScoreSchema,
  team: z
    .object({
      id: z.union([z.string(), z.number()]).nullish(),
      abbreviation: z.string().nullish(),
      displayName: z.string().nullish(),
      shortDisplayName: z.string().nullish(),
      /** The team's colors as hex strings without the hash. */
      color: z.string().nullish(),
      alternateColor: z.string().nullish(),
    })
    .nullish(),
});

const statusSchema = z.object({
  displayClock: z.string().nullish(),
  period: z.number().nullish(),
  type: z
    .object({
      /** "STATUS_FINAL", "STATUS_HALFTIME"…; finer than `state`. */
      name: z.string().nullish(),
      state: z.string().nullish(),
      completed: z.boolean().nullish(),
      shortDetail: z.string().nullish(),
      detail: z.string().nullish(),
      description: z.string().nullish(),
    })
    .nullish(),
});

/**
 * Present only while a game is under way. Between plays `down` can be stale or
 * `-1`, so the display text, not the down, signals a pending snap.
 */
const situationSchema = z.object({
  down: z.number().nullish(),
  distance: z.number().nullish(),
  /** Yards from the home goal line; see `~/lib/field`. */
  yardLine: z.number().nullish(),
  downDistanceText: z.string().nullish(),
  possession: z.union([z.string(), z.number()]).nullish(),
  isRedZone: z.boolean().nullish(),
  homeTimeouts: z.number().nullish(),
  awayTimeouts: z.number().nullish(),
  lastPlay: z
    .object({
      /** The play's id, as in the game's summary. */
      id: z.union([z.string(), z.number()]).nullish(),
      text: z.string().nullish(),
      team: z
        .object({ id: z.union([z.string(), z.number()]).nullish() })
        .nullish(),
      drive: z
        .object({
          description: z.string().nullish(),
          start: z.object({ yardLine: z.number().nullish() }).nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

const competitionSchema = z.object({
  status: statusSchema.nullish(),
  situation: situationSchema.nullish(),
  competitors: z.array(competitorSchema).nullish(),
  neutralSite: z.boolean().nullish(),
  broadcasts: z
    .array(
      z.object({
        media: z.object({ shortName: z.string().nullish() }).nullish(),
        names: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
  /** "AFC Wild Card Playoffs", "Super Bowl LX", "Pro Bowl Games". */
  notes: z.array(z.object({ headline: z.string().nullish() })).nullish(),
});

const weekSchema = z.object({ number: z.number().nullish() }).nullish();

const eventSchema = z.object({
  id: z.union([z.string(), z.number()]),
  date: z.string().nullish(),
  week: weekSchema,
  competitions: z.array(competitionSchema).nullish(),
});

export const scoreboardSchema = z.object({
  season: z
    .object({ year: z.number().nullish(), type: z.number().nullish() })
    .nullish(),
  week: weekSchema,
  events: z.array(eventSchema).nullish(),
});

export type GameState = "pre" | "in" | "post";

type Side = "team" | "opponent";

/** Spots are yards from the home goal line; see `~/lib/field`. */
export interface FieldState {
  offense: "home" | "away";
  ballOn: number;
  /** Null when it is goal to go, or no snap is pending. */
  lineToGain: number | null;
  /**
   * Oldest first, ending at `ballOn`. The scoreboard gives only the drive's
   * start; play-by-play fills in each snap.
   */
  driveSpots: number[];
}

export interface SituationState {
  /** "4th & 21 at SF 32"; null when no snap is pending. */
  downDistance: string | null;
  possession: Side | null;
  isRedZone: boolean;
  timeouts: { team: number | null; opponent: number | null };
  lastPlay: string | null;
  /** "10 plays, 35 yards, 6:17" for the drive the last play belongs to. */
  drive: string | null;
  /** Null when nobody has the ball: after a score, at the half. */
  field: FieldState | null;
}

interface SideScore {
  abbreviation: string;
  score: number | null;
  /** Points per period so far, overtime included. */
  periods: number[];
}

/** A game on the scoreboard, from one team's side. */
export interface LiveScore {
  gameId: string;
  state: GameState;
  detail: string;
  period: number | null;
  clock: string | null;
  completed: boolean;
  team: SideScore;
  opponent: SideScore;
  situation: SituationState | null;
}

interface BoardSide {
  abbreviation: string;
  score: number | null;
}

/** A game's clock and score as the week's scoreboard has it. */
export interface BoardGame {
  gameId: string;
  state: GameState;
  detail: string;
  period: number | null;
  clock: string | null;
  completed: boolean;
  /** The newest play's id, as in the game's summary; null when none is. */
  lastPlayId: string | null;
  home: BoardSide;
  away: BoardSide;
}

export type Scoreboard = z.infer<typeof scoreboardSchema>;
