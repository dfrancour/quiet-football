import { type Team, type TeamRegistry } from "~/lib/teams.schema";

export function teamById(registry: TeamRegistry, teamId: string): Team | null {
  return registry.teams.find((team) => team.teamId === teamId) ?? null;
}

export function teamByAbbreviation(
  registry: TeamRegistry,
  abbreviation: string,
): Team | null {
  const target = abbreviation.toUpperCase();
  return (
    registry.teams.find((team) => team.abbreviation.toUpperCase() === target) ??
    null
  );
}

/**
 * ESPN's abbreviation for each of the 32 teams, so the static export can
 * name every team page. A page for an abbreviation ESPN no longer uses is
 * harmless: an unknown team falls back to the standings.
 */
export const TEAM_ABBREVIATIONS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WSH",
] as const;
