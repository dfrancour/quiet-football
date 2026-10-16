import { z } from "zod";

export const conferenceSchema = z.enum(["AFC", "NFC"]);
export const divisionSchema = z.enum(["East", "North", "South", "West"]);

export const teamSchema = z.object({
  /** ESPN's stable numeric team id, as a string. */
  teamId: z.string(),
  abbreviation: z.string(),
  displayName: z.string(),
  shortDisplayName: z.string(),
  nickname: z.string(),
  location: z.string(),
  /** Hex without the hash; null for a team no scoreboard has named. */
  color: z.string().nullable(),
  /** Null only on the stand-in for a team the registry lacks. */
  conference: conferenceSchema.nullable(),
  division: divisionSchema.nullable(),
  /** ESPN's CDN URL for the dark-variant mark; null if ESPN has none. */
  logo: z.string().nullable(),
});

export const teamRegistrySchema = z.object({
  teams: z.array(teamSchema),
});

export type Conference = z.infer<typeof conferenceSchema>;
export type Division = z.infer<typeof divisionSchema>;
export type Team = z.infer<typeof teamSchema>;
export type TeamRegistry = z.infer<typeof teamRegistrySchema>;
