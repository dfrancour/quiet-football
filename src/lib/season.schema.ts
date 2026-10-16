import { z } from "zod";

export const gameStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "final",
  "postponed",
  "canceled",
]);

export const gameOutcomeSchema = z.enum(["win", "loss", "tie"]);

export const venueSchema = z.object({
  name: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
});

export const gameSideSchema = z.object({
  teamId: z.string(),
  score: z.number().nullable(),
  /** Points per period, overtime included. Absent until the game has started. */
  periods: z.array(z.number()).optional(),
});

/** Held once for the league; per-team schedules are derived from it. */
export const seasonGameSchema = z.object({
  /** ESPN's event id. */
  gameId: z.string(),
  week: z.number(),
  kickoff: z.string(),
  status: gameStatusSchema,
  neutralSite: z.boolean(),
  broadcast: z.string().nullable(),
  venue: venueSchema,
  home: gameSideSchema,
  away: gameSideSchema,
});

/** The regular season's games, then the playoffs' (`season-calendar.ts`). */
export const seasonSchema = z.object({
  season: z.number(),
  /** Regular-season weeks; playoff rounds follow as weeks after them. */
  totalWeeks: z.number(),
  games: z.array(seasonGameSchema),
});

export type GameStatus = z.infer<typeof gameStatusSchema>;
export type GameOutcome = z.infer<typeof gameOutcomeSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type GameSide = z.infer<typeof gameSideSchema>;
export type SeasonGame = z.infer<typeof seasonGameSchema>;
export type SeasonFile = z.infer<typeof seasonSchema>;
