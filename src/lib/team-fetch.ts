import { z } from "zod";
import { type Scoreboard } from "~/lib/score.schema";
import {
  type Division,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";
import { fetchUpstream } from "~/lib/upstream";

/**
 * The registry comes from ESPN's standings endpoint: it names every team with
 * its conference and division and answers cross-origin requests, which the
 * teams endpoint does not. It omits each team's colors, which a scoreboard
 * carries (`teamColors`).
 */

export const STANDINGS_URL =
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

export type TeamColors = Pick<Team, "color" | "alternateColor">;

/** Each team's colors by id, from any scoreboard naming it. */
export function teamColors(scoreboard: Scoreboard): Map<string, TeamColors> {
  const colors = new Map<string, TeamColors>();
  for (const event of scoreboard.events ?? []) {
    for (const competitor of event.competitions?.[0]?.competitors ?? []) {
      const { id, color, alternateColor } = competitor.team ?? {};
      if (id != null && (color || alternateColor)) {
        colors.set(String(id), {
          color: color || null,
          alternateColor: alternateColor || null,
        });
      }
    }
  }
  return colors;
}

/**
 * Every team under its conference and division. Refuses an empty league, and
 * a conference or division it does not know, which would silently drop its
 * teams from the standings. A team the scoreboard did not name has no colors.
 */
export function teamRegistryFromEspn(
  standingsPayload: unknown,
  colors: ReadonlyMap<string, TeamColors>,
): TeamRegistry {
  const teams: Team[] = [];
  const unplaced: string[] = [];
  const parsed = standingsPayloadSchema.safeParse(standingsPayload);
  if (!parsed.success) throw new Error("ESPN's standings are unreadable");
  for (const conference of parsed.data.children ?? []) {
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
        const palette = colors.get(String(team.id));
        teams.push({
          teamId: String(team.id),
          abbreviation: team.abbreviation,
          displayName: team.displayName ?? team.abbreviation,
          nickname: team.name ?? team.shortDisplayName ?? team.abbreviation,
          color: palette?.color ?? null,
          alternateColor: palette?.alternateColor ?? null,
          conference: conferenceName,
          division: divisionName,
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
