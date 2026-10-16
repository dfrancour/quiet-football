import { z } from "zod";

/** ESPN's standing in the playoff race for one team. */
export const playoffMarkSchema = z.object({
  /** The conference seed as things stand; ESPN ranks all sixteen teams. */
  seed: z.number().int().positive().nullable(),
  /** ESPN's code: `x`, `y`, `z`, `*`, `**` or `e`. */
  clincher: z.string().nullable(),
});

/** One season's marks, by team id, as ESPN last reported them. */
export const playoffMarksSchema = z.object({
  season: z.number(),
  fetchedAt: z.string(),
  teams: z.record(z.string(), playoffMarkSchema),
});

export type PlayoffMark = z.infer<typeof playoffMarkSchema>;
export type PlayoffMarks = z.infer<typeof playoffMarksSchema>;
