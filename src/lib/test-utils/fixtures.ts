import { type RecapsFile } from "~/lib/recaps";
import { type SeasonFile, type SeasonGame } from "~/lib/season.schema";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";
import {
  type Conference,
  type Division,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";

function team(
  teamId: string,
  abbreviation: string,
  location: string,
  nickname: string,
  conference: Conference,
  division: Division,
): Team {
  return {
    teamId,
    abbreviation,
    displayName: `${location} ${nickname}`,
    shortDisplayName: nickname,
    nickname,
    location,
    color: null,
    alternateColor: null,
    conference,
    division,
    logo: `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${abbreviation.toLowerCase()}.png`,
  };
}

/** Real ESPN team ids, so fixtures line up with the league ESPN reports. */
export const TEAMS = {
  CHI: team("3", "CHI", "Chicago", "Bears", "NFC", "North"),
  CLE: team("5", "CLE", "Cleveland", "Browns", "AFC", "North"),
  DET: team("8", "DET", "Detroit", "Lions", "NFC", "North"),
  GB: team("9", "GB", "Green Bay", "Packers", "NFC", "North"),
  MIA: team("15", "MIA", "Miami", "Dolphins", "AFC", "East"),
  MIN: team("16", "MIN", "Minnesota", "Vikings", "NFC", "North"),
  NE: team("17", "NE", "New England", "Patriots", "AFC", "East"),
  NO: team("18", "NO", "New Orleans", "Saints", "NFC", "South"),
  NYG: team("19", "NYG", "New York", "Giants", "NFC", "East"),
  NYJ: team("20", "NYJ", "New York", "Jets", "AFC", "East"),
  PIT: team("23", "PIT", "Pittsburgh", "Steelers", "AFC", "North"),
  TB: team("27", "TB", "Tampa Bay", "Buccaneers", "NFC", "South"),
  WSH: team("28", "WSH", "Washington", "Commanders", "NFC", "East"),
} as const;

export const REGISTRY: TeamRegistry = { teams: Object.values(TEAMS) };

export function makeTeamRegistry(teams: Team[]): TeamRegistry {
  return { teams };
}

/** MIN at NO, week 5 of 2026, by ESPN's id. */
export const GAME_ID = "401872987";

export function makeSeasonGame(
  overrides: Partial<SeasonGame> = {},
): SeasonGame {
  return {
    gameId: GAME_ID,
    week: 5,
    kickoff: "2026-10-11T17:00:00.000Z",
    status: "scheduled",
    neutralSite: false,
    broadcast: "Fox",
    venue: { name: "Caesars Superdome", city: "New Orleans", state: "LA" },
    home: { teamId: TEAMS.NO.teamId, score: null },
    away: { teamId: TEAMS.MIN.teamId, score: null },
    ...overrides,
  };
}

export function makeSeason(
  games: SeasonGame[],
  overrides: Partial<SeasonFile> = {},
): SeasonFile {
  return {
    season: 2026,
    totalWeeks: 18,
    games,
    ...overrides,
  };
}

export function makeTeamGame(overrides: Partial<TeamGame> = {}): TeamGame {
  return {
    gameId: GAME_ID,
    week: 5,
    round: null,
    gate: [],
    kickoff: "2026-10-11T17:00:00.000Z",
    status: "scheduled",
    homeAway: "away",
    neutralSite: false,
    opponent: TEAMS.NO,
    venue: { name: "Caesars Superdome", city: "New Orleans", state: "LA" },
    broadcast: "Fox",
    result: null,
    periods: null,
    recordsBefore: {
      team: { wins: 0, losses: 0, ties: 0 },
      opponent: { wins: 0, losses: 0, ties: 0 },
    },
    ...overrides,
  };
}

export function makeTeamSchedule(
  games: TeamGame[],
  overrides: Partial<TeamSchedule> = {},
): TeamSchedule {
  return {
    season: 2026,
    totalWeeks: 18,
    team: TEAMS.MIN,
    games,
    byeWeeks: [6],
    ...overrides,
  };
}

export function makeRecaps(
  recaps: RecapsFile["recaps"] = {},
  season = 2026,
): RecapsFile {
  return { season, recaps };
}
