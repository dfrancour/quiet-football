import {
  extractScoreboard,
  readPeriods,
  readScore,
  type Competition,
  type Competitor,
} from "~/lib/score";
import { scoreboardSchema, type BoardGame } from "~/lib/score.schema";
import {
  PLAYOFF_ROUNDS,
  playoffRound,
  playoffWeek,
  regularSeasonWeeks,
  type PlayoffRound,
} from "~/lib/season-calendar";
import {
  type GameSide,
  type GameStatus,
  type SeasonFile,
  type SeasonGame,
} from "~/lib/season.schema";
import { gamePhase } from "~/lib/schedule";

export const REGULAR_SEASON_TYPE = 2;
export const POSTSEASON_TYPE = 3;

/**
 * ESPN's postseason weeks: one per round, with the Pro Bowl before the Super
 * Bowl, which has been week 5 since 2015.
 */
const ESPN_ROUND_WEEKS: Readonly<Record<PlayoffRound, number>> = {
  "wild-card": 1,
  divisional: 2,
  conference: 3,
  "super-bowl": 5,
};

export const SCOREBOARD_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

function scoreboardUrl(season: number, type: number, week: number): string {
  return `${SCOREBOARD_BASE}?dates=${season}&seasontype=${type}&week=${week}`;
}

/** ESPN's scoreboard for one of the app's weeks, playoff rounds included. */
export function weekScoreboardUrl(season: number, week: number): string {
  const round = playoffRound(regularSeasonWeeks(season), week);
  return round
    ? scoreboardUrl(season, POSTSEASON_TYPE, ESPN_ROUND_WEEKS[round])
    : scoreboardUrl(season, REGULAR_SEASON_TYPE, week);
}

/**
 * The app's week for an event. A postseason week is its round, read from
 * ESPN's week for the first three and from the headline after, since the Pro
 * Bowl shares those weeks. Null for anything else (preseason, the Pro Bowl);
 * a payload naming no season type is read as the regular season.
 */
function appWeek(
  season: number | null,
  seasonType: number | null,
  espnWeek: number,
  headline: string | null,
): number | null {
  if (seasonType === REGULAR_SEASON_TYPE || seasonType === null) {
    return espnWeek;
  }
  if (seasonType !== POSTSEASON_TYPE || season === null) return null;
  const totalWeeks = regularSeasonWeeks(season);
  if (espnWeek >= 1 && espnWeek <= 3) {
    return playoffWeek(totalWeeks, PLAYOFF_ROUNDS[espnWeek - 1]!);
  }
  return headline && /super bowl/i.test(headline)
    ? playoffWeek(totalWeeks, "super-bowl")
    : null;
}

/** ESPN names a playoff team not yet known with a negative id. */
function isKnownTeam(id: string | number | null | undefined): boolean {
  return id != null && Number(id) > 0;
}

/** ESPN's status, by its name where that is finer than its state. */
function readStatus(
  type:
    | NonNullable<NonNullable<Competition["status"]>["type"]>
    | null
    | undefined,
): GameStatus {
  switch (type?.name) {
    case "STATUS_FINAL":
      return "final";
    case "STATUS_IN_PROGRESS":
    case "STATUS_HALFTIME":
    case "STATUS_END_PERIOD":
      return "in_progress";
    case "STATUS_POSTPONED":
      return "postponed";
    case "STATUS_CANCELED":
      return "canceled";
    default:
      break;
  }
  if (type?.state === "post") return "final";
  if (type?.state === "in") return "in_progress";
  return "scheduled";
}

/** A side as stored; `periods` is left off until the game has started. */
function toSide(competitor: Competitor, teamId: string): GameSide {
  const periods = readPeriods(competitor);
  return {
    teamId,
    score: readScore(competitor.score),
    ...(periods.length > 0 ? { periods } : {}),
  };
}

function readBroadcast(competition: Competition): string | null {
  for (const entry of competition.broadcasts ?? []) {
    const name = entry.media?.shortName ?? entry.names?.[0];
    if (name) return name;
  }
  return null;
}

export interface SeasonScoreboard {
  season: number | null;
  seasonType: number | null;
  games: SeasonGame[];
}

/**
 * Regular-season and playoff games, each under the app's week. Events missing
 * a team, kickoff or week are dropped, as are playoff games not yet set (ESPN
 * lists them with "TBD" teams) and the Pro Bowl.
 */
export function seasonGamesFromScoreboard(payload: unknown): SeasonScoreboard {
  const parsed = scoreboardSchema.safeParse(payload);
  if (!parsed.success) return { season: null, seasonType: null, games: [] };
  const board = parsed.data;
  const season = board.season?.year ?? null;
  const seasonType = board.season?.type ?? null;

  const games = (board.events ?? []).flatMap((event): SeasonGame[] => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((entry) => entry.homeAway === "home");
    const away = competitors.find((entry) => entry.homeAway === "away");
    const homeId = home?.team?.id;
    const awayId = away?.team?.id;
    const espnWeek = event.week?.number ?? board.week?.number;
    const week =
      espnWeek == null
        ? null
        : appWeek(
            season,
            seasonType,
            espnWeek,
            competition?.notes?.[0]?.headline ?? null,
          );
    if (
      !competition ||
      !home ||
      !away ||
      !isKnownTeam(homeId) ||
      !isKnownTeam(awayId) ||
      !event.date ||
      week === null
    ) {
      return [];
    }

    return [
      {
        gameId: String(event.id),
        week,
        kickoff: event.date,
        status: readStatus(competition.status?.type),
        neutralSite: competition.neutralSite === true,
        broadcast: readBroadcast(competition),
        home: toSide(home, String(homeId)),
        away: toSide(away, String(awayId)),
      },
    ];
  });

  return { season, seasonType, games };
}

/** Kickoff, then ESPN's id. */
export function orderGames(games: readonly SeasonGame[]): SeasonGame[] {
  return [...games].sort(
    (a, b) =>
      Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
      a.gameId.localeCompare(b.gameId),
  );
}

/** One week's scoreboard, read once as it arrives. */
export interface WeekBoard {
  season: number;
  week: number;
  /**
   * ESPN's payload trimmed to the fields read, for a team's live score
   * (`extractTeamScore`) and for saving a settled week (`week-store.ts`).
   */
  payload: unknown;
  games: SeasonGame[];
  /** Each game's clock and score, for the week view. */
  board: BoardGame[];
}

/**
 * Reads a week's scoreboard; throws on one that is not a scoreboard. A
 * regular-season game is filed under the week it was fetched for, which ESPN
 * keeps on a postponed game; a playoff round's games carry their own.
 */
export function readWeek(
  season: number,
  week: number,
  payload: unknown,
): WeekBoard {
  // Every field is optional, so a body with no events is no scoreboard.
  const parsed = scoreboardSchema.safeParse(payload);
  if (!parsed.success || !Array.isArray(parsed.data.events)) {
    throw new Error(`ESPN's ${season} week ${week} scoreboard is unreadable`);
  }
  const games = seasonGamesFromScoreboard(payload).games;
  return {
    season,
    week,
    payload: parsed.data,
    games: playoffRound(regularSeasonWeeks(season), week)
      ? games
      : games.map((game) => ({ ...game, week })),
    board: extractScoreboard(payload),
  };
}

/** A season from every one of its weeks (`season-calendar.ts`). */
export function seasonFromWeeks(
  season: number,
  weeks: readonly WeekBoard[],
): SeasonFile {
  return {
    season,
    totalWeeks: regularSeasonWeeks(season),
    games: orderGames(weeks.flatMap((week) => week.games)),
  };
}

/** Postponed is not settled: ESPN reschedules it, keeping its week. */
export function isSettled(game: Pick<SeasonGame, "status">): boolean {
  return game.status === "final" || game.status === "canceled";
}

export type WeekActivity = "live" | "settled" | "ahead";

/**
 * What a week's scoreboard is doing: `live` while a game in it has kicked
 * off and is not settled, `settled` once every game is, else `ahead`, when
 * a kickoff can still move (flex scheduling, Week 18) or a playoff round is
 * still being set.
 */
export function weekActivity(
  games: readonly SeasonGame[],
  now: number,
): WeekActivity {
  if (games.some((game) => gamePhase(game, now) === "live")) return "live";
  if (games.length > 0 && games.every(isSettled)) return "settled";
  return "ahead";
}
