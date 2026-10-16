import { z } from "zod";
import {
  type PlayoffMark,
  type PlayoffMarks,
} from "~/lib/playoff-marks.schema";
import { fetchUpstream } from "~/lib/upstream";

/**
 * Seeds and clinch marks come from ESPN rather than being derived: they need
 * the full multi-team tiebreakers and every remaining result.
 */

const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

/** Seeds that make the playoffs: seven per conference since 2020. */
export const PLAYOFF_SEEDS = 7;

const CLINCHER_NAMES: Readonly<Record<string, string>> = {
  x: "Clinched a playoff berth",
  y: "Clinched a wild card",
  z: "Clinched the division",
  "*": "Clinched a first-round bye",
  "**": "Clinched home field throughout",
  e: "Eliminated",
};

/** What a clinch code means, for its tooltip. */
export function clincherName(code: string): string | null {
  return CLINCHER_NAMES[code] ?? null;
}

const statSchema = z.object({
  name: z.string().nullish(),
  value: z.number().nullish(),
  displayValue: z.string().nullish(),
});

const payloadSchema = z.object({
  children: z
    .array(
      z.object({
        standings: z
          .object({
            entries: z
              .array(
                z.object({
                  team: z
                    .object({ id: z.union([z.string(), z.number()]) })
                    .nullish(),
                  stats: z.array(statSchema).nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});

function readMark(stats: readonly z.infer<typeof statSchema>[]): PlayoffMark {
  const seed = stats.find((stat) => stat.name === "playoffSeed")?.value;
  const clincher = stats
    .find((stat) => stat.name === "clincher")
    ?.displayValue?.trim();
  return {
    seed: seed != null && Number.isInteger(seed) && seed > 0 ? seed : null,
    clincher: clincher ? clincher : null,
  };
}

/** ESPN's conference standings, by team id. */
export function playoffMarksFromEspn(
  season: number,
  payload: unknown,
  fetchedAt: string,
): PlayoffMarks {
  const teams: Record<string, PlayoffMark> = {};
  for (const conference of payloadSchema.parse(payload).children ?? []) {
    for (const entry of conference.standings?.entries ?? []) {
      if (entry.team) {
        teams[String(entry.team.id)] = readMark(entry.stats ?? []);
      }
    }
  }
  if (Object.keys(teams).length === 0) {
    throw new Error(`ESPN's ${season} standings name no teams`);
  }
  return { season, fetchedAt, teams };
}

export async function fetchPlayoffMarks(
  season: number,
  signal?: AbortSignal,
): Promise<PlayoffMarks> {
  const payload = await fetchUpstream(
    `${STANDINGS_URL}?season=${season}`,
    signal,
  );
  return playoffMarksFromEspn(season, payload, new Date().toISOString());
}
