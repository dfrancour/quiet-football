import { matchupGates, type GateGame } from "~/lib/playoffs";
import {
  gamesForTeam,
  NO_RECORD,
  outcomeOf,
  recordAsShown,
  recordsAround,
  type RecordsAround,
  type TeamRecord,
} from "~/lib/season";
import { playoffRound, type PlayoffRound } from "~/lib/season-calendar";
import {
  type GameOutcome,
  type GameStatus,
  type SeasonFile,
} from "~/lib/season.schema";
import { type RecordsShown } from "~/lib/spoilers";
import { teamById } from "~/lib/teams";
import { type Team, type TeamRegistry } from "~/lib/teams.schema";

/** A game from one team's side; derived, never stored. */
export interface TeamGame {
  gameId: string;
  week: number;
  /** Null in the regular season. */
  round: PlayoffRound | null;
  /** Games to be seen before a playoff matchup is shown (`playoffs.ts`). */
  gate: GateGame[];
  kickoff: string;
  status: GameStatus;
  homeAway: "home" | "away";
  neutralSite: boolean;
  opponent: Team;
  broadcast: string | null;
  result: {
    teamScore: number;
    opponentScore: number;
    outcome: GameOutcome;
  } | null;
  /** Points per period for each side; null until both sides have any. */
  periods: { team: number[]; opponent: number[] } | null;
  recordsBefore: { team: TeamRecord; opponent: TeamRecord };
  /** Counting this game too, once it is final and in the regular season. */
  recordsAfter: { team: TeamRecord; opponent: TeamRecord };
}

export interface TeamSchedule {
  season: number;
  totalWeeks: number;
  team: Team;
  games: TeamGame[];
  byeWeeks: number[];
}

/** Keeps a game renderable when the registry lacks the team. */
function unknownTeam(teamId: string): Team {
  return {
    teamId,
    abbreviation: "???",
    displayName: "Unknown",
    nickname: "Unknown",
    color: null,
    alternateColor: null,
    conference: null,
    division: null,
    logo: null,
  };
}

export function buildTeamSchedule(
  season: SeasonFile,
  registry: TeamRegistry,
  teamId: string,
): TeamSchedule {
  const team = teamById(registry, teamId) ?? unknownTeam(teamId);
  const gates = matchupGates(season, registry);
  const records = recordsAround(season);

  const games: TeamGame[] = gamesForTeam(season, teamId).map((game) => {
    const isHome = game.home.teamId === teamId;
    const own = isHome ? game.home : game.away;
    const other = isHome ? game.away : game.home;
    const around = records.get(game.gameId);
    const ownRecords = around?.[isHome ? "home" : "away"] ?? UNRECORDED;
    const otherRecords = around?.[isHome ? "away" : "home"] ?? UNRECORDED;

    const teamScore = own.score;
    const opponentScore = other.score;
    const played =
      game.status === "final" && teamScore !== null && opponentScore !== null;

    return {
      gameId: game.gameId,
      week: game.week,
      round: playoffRound(season.totalWeeks, game.week),
      gate: gates.get(game.gameId) ?? [],
      kickoff: game.kickoff,
      status: game.status,
      homeAway: isHome ? "home" : "away",
      neutralSite: game.neutralSite,
      opponent: teamById(registry, other.teamId) ?? unknownTeam(other.teamId),
      broadcast: game.broadcast,
      result: played
        ? {
            teamScore,
            opponentScore,
            outcome: outcomeOf(teamScore, opponentScore),
          }
        : null,
      recordsBefore: {
        team: ownRecords.before,
        opponent: otherRecords.before,
      },
      recordsAfter: {
        team: ownRecords.after,
        opponent: otherRecords.after,
      },
      periods:
        own.periods && other.periods
          ? { team: own.periods, opponent: other.periods }
          : null,
    };
  });

  const playedWeeks = new Set(games.map((game) => game.week));
  const byeWeeks: number[] = [];
  for (let week = 1; week <= season.totalWeeks; week += 1) {
    if (!playedWeeks.has(week)) byeWeeks.push(week);
  }

  return {
    season: season.season,
    totalWeeks: season.totalWeeks,
    team,
    games,
    byeWeeks,
  };
}

/** The records `shown` names for both sides of a team's game; null for none. */
export function teamGameRecords(
  season: SeasonFile,
  teamId: string,
  game: TeamGame,
  shown: RecordsShown,
): { team: TeamRecord; opponent: TeamRecord } | null {
  if (shown === null) return null;
  return {
    team: recordAsShown(season, shown, teamId, {
      before: game.recordsBefore.team,
      after: game.recordsAfter.team,
    }),
    opponent: recordAsShown(season, shown, game.opponent.teamId, {
      before: game.recordsBefore.opponent,
      after: game.recordsAfter.opponent,
    }),
  };
}

const UNRECORDED: RecordsAround = { before: NO_RECORD, after: NO_RECORD };
