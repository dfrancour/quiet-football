import { z } from "zod";
import { scoreboardSchema } from "~/lib/score.schema";
import {
  type Conference,
  type Division,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";
import { fetchUpstream } from "~/lib/upstream";

/**
 * The registry comes from ESPN's standings endpoint: it names every team with
 * its conference and division and answers cross-origin requests, which the
 * teams endpoint does not. It omits each team's color, which a scoreboard
 * carries (`teamColors`).
 */

const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

const logoSchema = z.object({
  href: z.string(),
  rel: z.array(z.string()).optional(),
});

const espnTeamSchema = z.object({
  id: z.union([z.string(), z.number()]),
  abbreviation: z.string(),
  displayName: z.string().optional(),
  shortDisplayName: z.string().optional(),
  name: z.string().optional(),
  location: z.string().optional(),
  logos: z.array(logoSchema).optional(),
});

const standingsPayloadSchema = z.object({
  children: z
    .array(
      z.object({
        abbreviation: z.string().optional(),
        children: z
          .array(
            z.object({
              name: z.string().optional(),
              standings: z
                .object({
                  entries: z
                    .array(z.object({ team: espnTeamSchema.optional() }))
                    .optional(),
                })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

const DIVISIONS: ReadonlySet<string> = new Set([
  "East",
  "North",
  "South",
  "West",
]);

function isDivision(name: string): name is Division {
  return DIVISIONS.has(name);
}

/** The full dark mark; `guid` entries are 4096px brand assets. */
export function pickLogoHref(
  logos: readonly z.infer<typeof logoSchema>[] | undefined,
): string | null {
  const full = (logos ?? []).filter((logo) => logo.rel?.includes("full"));
  const dark = full.find((logo) => logo.rel?.includes("dark"));
  const fallback = full.find((logo) => logo.rel?.includes("default"));
  return dark?.href ?? fallback?.href ?? null;
}

/** Each team's color by id, from any scoreboard naming it. */
export function teamColors(scoreboard: unknown): Map<string, string> {
  const colors = new Map<string, string>();
  const parsed = scoreboardSchema.safeParse(scoreboard);
  if (!parsed.success) return colors;
  for (const event of parsed.data.events ?? []) {
    for (const competitor of event.competitions?.[0]?.competitors ?? []) {
      const { id, color } = competitor.team ?? {};
      if (id != null && color) colors.set(String(id), color);
    }
  }
  return colors;
}

/**
 * Every team under its conference and division. Refuses an empty league, and
 * a conference or division it does not know, which would silently drop its
 * teams from the standings. A team the scoreboard did not name has no color.
 */
export function teamRegistryFromEspn(
  standingsPayload: unknown,
  colors: ReadonlyMap<string, string>,
): TeamRegistry {
  const teams: Team[] = [];
  const unplaced: string[] = [];
  for (const conference of standingsPayloadSchema.parse(standingsPayload)
    .children ?? []) {
    const conferenceName = conference.abbreviation;
    for (const division of conference.children ?? []) {
      // "NFC West" -> "West"
      const divisionName = (division.name ?? "")
        .replace(conferenceName ?? "", "")
        .trim();
      const placed =
        (conferenceName === "AFC" || conferenceName === "NFC") &&
        isDivision(divisionName);
      for (const { team } of division.standings?.entries ?? []) {
        if (!team) continue;
        if (!placed) {
          unplaced.push(team.abbreviation);
          continue;
        }
        teams.push({
          teamId: String(team.id),
          abbreviation: team.abbreviation,
          displayName: team.displayName ?? team.abbreviation,
          shortDisplayName:
            team.shortDisplayName ?? team.name ?? team.abbreviation,
          nickname: team.name ?? team.shortDisplayName ?? team.abbreviation,
          location: team.location ?? "",
          color: colors.get(String(team.id)) ?? null,
          conference: conferenceName as Conference,
          division: divisionName as Division,
          logo: pickLogoHref(team.logos),
        });
      }
    }
  }
  if (unplaced.length > 0) {
    throw new Error(`No division for ${unplaced.join(", ")}`);
  }
  if (teams.length === 0) throw new Error("ESPN's standings name no teams");

  return {
    teams: teams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation)),
  };
}

/**
 * A season's standings, every team under its division (`level=3`). One
 * payload serves the registry and the playoff marks (`playoff-marks.ts`).
 */
export async function fetchStandings(
  season: number,
  signal?: AbortSignal,
): Promise<unknown> {
  return fetchUpstream(`${STANDINGS_URL}?level=3&season=${season}`, signal);
}
