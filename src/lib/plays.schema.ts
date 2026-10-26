import { z } from "zod";

const idSchema = z.union([z.string(), z.number()]);

/** A play's spot before or after the snap; see `~/lib/field` for the frame. */
const rawSpotSchema = z.object({
  down: z.number().nullish(),
  distance: z.number().nullish(),
  /** Yards from the home goal line. */
  yardLine: z.number().nullish(),
  downDistanceText: z.string().nullish(),
});

const rawPlaySchema = z.object({
  id: idSchema,
  type: z
    .object({ id: idSchema.nullish(), text: z.string().nullish() })
    .nullish(),
  text: z.string().nullish(),
  awayScore: z.number().nullish(),
  homeScore: z.number().nullish(),
  period: z.object({ number: z.number().nullish() }).nullish(),
  clock: z.object({ displayValue: z.string().nullish() }).nullish(),
  scoringPlay: z.boolean().nullish(),
  isTurnover: z.boolean().nullish(),
  isPenalty: z.boolean().nullish(),
  start: rawSpotSchema.nullish(),
  end: rawSpotSchema.nullish(),
  penalty: z
    .object({ type: z.object({ text: z.string().nullish() }).nullish() })
    .nullish(),
});

const rawDriveSchema = z.object({
  id: idSchema,
  description: z.string().nullish(),
  /** Absent while the drive is still going. */
  displayResult: z.string().nullish(),
  isScore: z.boolean().nullish(),
  team: z.object({ id: idSchema.nullish() }).nullish(),
  plays: z.array(rawPlaySchema).nullish(),
});

/** The parts of ESPN's game `summary` that play-by-play reads. */
export const summarySchema = z.object({
  header: z
    .object({
      competitions: z
        .array(
          z.object({
            status: z
              .object({
                type: z.object({ completed: z.boolean().nullish() }).nullish(),
              })
              .nullish(),
            competitors: z
              .array(
                z.object({
                  id: idSchema,
                  homeAway: z.string().nullish(),
                  team: z
                    .object({ abbreviation: z.string().nullish() })
                    .nullish(),
                }),
              )
              .nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  drives: z
    .object({
      previous: z.array(rawDriveSchema).nullish(),
      current: rawDriveSchema.nullish(),
    })
    .nullish(),
});

/**
 * `snap`: a play from scrimmage. `kick`: no down (kickoff, try). `stoppage`:
 * a timeout or end of period, shown in the feed but not on the field.
 */
export const playKindSchema = z.enum(["snap", "kick", "stoppage"]);

/** Null on a play when it cannot be told, e.g. a pre-snap penalty. */
export const playActionSchema = z.enum([
  "run",
  "pass",
  "punt",
  "kickoff",
  "fieldGoal",
]);

/** A play that ends a possession or puts points up, and how. */
export const playOutcomeSchema = z.enum([
  "touchdown",
  "fieldGoal",
  "noGood",
  "safety",
  "punt",
  "interception",
  "fumble",
]);

export const playSchema = z.object({
  id: z.string(),
  kind: playKindSchema,
  action: playActionSchema.nullable(),
  outcome: playOutcomeSchema.nullable(),
  /** "7-yd Run", "Incompletion", "56-yd Punt". */
  headline: z.string(),
  /** Null for anything but a timeout. */
  timeoutBy: z.enum(["home", "away"]).nullable(),
  text: z.string(),
  period: z.number().nullable(),
  clock: z.string().nullable(),
  /** "3rd & 3 at BAL 45" before the snap; null for anything but a snap. */
  downDistance: z.string().nullable(),
  /** Null for anything but a snap. */
  down: z.number().nullable(),
  distance: z.number().nullable(),
  /** Yards from the home goal line; null for a stoppage. */
  start: z.number().nullable(),
  /**
   * Same frame as `start`; null for a stoppage. The next snap's `start` is
   * more reliable, since it includes post-whistle penalty enforcement.
   */
  end: z.number().nullable(),
  /**
   * The down the snap left for the next, by ESPN's word: "1st & 10 at PHI
   * 38" and the yards it needs. Null for anything but a snap, or when ESPN
   * gives none, as after a score. Like `end`, it misses post-whistle
   * enforcement, so it stands in only until the next snap or the scoreboard
   * says otherwise.
   */
  nextDown: z
    .object({ downDistance: z.string(), distance: z.number() })
    .nullable(),
  scoring: z.boolean(),
  turnover: z.boolean(),
  penalty: z.boolean(),
  /** The score once the play was over. */
  score: z.object({ home: z.number(), away: z.number() }).nullable(),
});

export const driveSchema = z.object({
  id: z.string(),
  offense: z.enum(["home", "away"]).nullable(),
  /** "10 plays, 62 yards, 4:33". */
  description: z.string().nullable(),
  /** "Field Goal", "Punt"; null while the drive is still going. */
  result: z.string().nullable(),
  isScore: z.boolean(),
  inProgress: z.boolean(),
  /** Oldest first. */
  plays: z.array(playSchema),
});

export type Summary = z.infer<typeof summarySchema>;
export type PlayKind = z.infer<typeof playKindSchema>;
export type PlayAction = z.infer<typeof playActionSchema>;
export type PlayOutcome = z.infer<typeof playOutcomeSchema>;
export type Play = z.infer<typeof playSchema>;
export type Drive = z.infer<typeof driveSchema>;

/**
 * One set of downs. `gainedBy` is how its first down was earned; null for the
 * drive's opening set.
 */
export interface Series {
  plays: Play[];
  gainedBy: "play" | "penalty" | null;
}

/** A game's plays, as its summary last had them. */
export interface PlayByPlay {
  gameId: string;
  /** Oldest first, the drive under way last. */
  drives: Drive[];
  /**
   * Whether the summary's own header calls the game over: until it does, the
   * last plays may still be on their way, whatever the scoreboard says.
   */
  final: boolean;
}
