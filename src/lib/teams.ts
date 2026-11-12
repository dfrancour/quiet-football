import {
  type Conference,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";

/** NFC first, as the league page lays them out, the standings and bracket alike. */
export const CONFERENCE_ORDER: readonly Conference[] = ["NFC", "AFC"];

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
 * ESPN's abbreviation for each of the 32 teams, with the team's name, so the
 * static export can name and title every team page before ESPN is asked. A
 * page for an abbreviation ESPN no longer uses is harmless: an unknown team
 * falls back to the standings.
 */
export const TEAM_NAMES = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WSH: "Washington Commanders",
} as const;

export type TeamAbbreviation = keyof typeof TEAM_NAMES;

export const TEAM_ABBREVIATIONS = Object.keys(
  TEAM_NAMES,
) as readonly TeamAbbreviation[];

/** A team page's name for the team: its full name, or the abbreviation. */
export function teamName(abbreviation: string): string {
  const key = abbreviation.toUpperCase();
  return Object.hasOwn(TEAM_NAMES, key)
    ? TEAM_NAMES[key as TeamAbbreviation]
    : key;
}
