import { type vi } from "vitest";
import { regularSeasonWeeks } from "~/lib/season-calendar";
import { TEAMS } from "~/lib/test-utils/fixtures";
import { stubFetch } from "~/lib/test-utils/query";
import { type Team } from "~/lib/teams.schema";

/**
 * A hand-written league for page tests: ESPN's scoreboards, standings and
 * summaries, and the recap dataset, answered from a list of games. Every
 * team in `TEAMS` is in the standings, under its own division.
 */

export interface LeagueGame {
  id: string;
  /** The app's week: a playoff round follows the regular season. */
  week: number;
  kickoff: string;
  away: Team;
  home: Team;
  /** Final scores, away then home; a game without them is still to come. */
  score?: [number, number];
  /**
   * ESPN's win probability for the home side, play by play; by default a
   * game that barely turned.
   */
  homeChances?: number[];
  /** The YouTube id of its recap, once the dataset has linked one. */
  recap?: string;
}

const SEASON = 2026;

function event(game: LeagueGame) {
  const final = game.score !== undefined;
  const competitor = (team: Team, homeAway: string, score?: number) => ({
    id: team.teamId,
    homeAway,
    score: score === undefined ? undefined : String(score),
    team: { id: team.teamId, abbreviation: team.abbreviation },
  });
  return {
    id: game.id,
    date: game.kickoff,
    week: { number: espnWeek(game.week) },
    competitions: [
      {
        status: {
          type: final
            ? { name: "STATUS_FINAL", state: "post", completed: true }
            : { name: "STATUS_SCHEDULED", state: "pre", completed: false },
        },
        competitors: [
          competitor(game.home, "home", game.score?.[1]),
          competitor(game.away, "away", game.score?.[0]),
        ],
      },
    ],
  };
}

/**
 * ESPN numbers the postseason from 1, Wild Card first; this holds through the
 * Conference round (the Super Bowl comes after the Pro Bowl).
 */
function espnWeek(week: number): number {
  const regular = regularSeasonWeeks(SEASON);
  return week > regular ? week - regular : week;
}

/**
 * ESPN's standings: each conference's teams with their seeds (every one
 * seeded first, which is all a page test needs), and its divisions.
 */
function standings() {
  const teams = Object.values(TEAMS);
  const entry = (team: Team) => ({
    team: {
      id: team.teamId,
      abbreviation: team.abbreviation,
      displayName: team.displayName,
      name: team.nickname,
    },
    stats: [{ name: "playoffSeed", value: 1 }],
  });
  return {
    children: (["AFC", "NFC"] as const).map((conference) => ({
      abbreviation: conference,
      standings: {
        entries: teams
          .filter((team) => team.conference === conference)
          .map(entry),
      },
      children: (["East", "North", "South", "West"] as const).map(
        (division) => ({
          name: `${conference} ${division}`,
          standings: {
            entries: teams
              .filter(
                (team) =>
                  team.conference === conference && team.division === division,
              )
              .map(entry),
          },
        }),
      ),
    })),
  };
}

/** ESPN's win probability feed for a finished game. */
function probabilities(game: LeagueGame) {
  const [away = 0, home = 0] = game.score ?? [];
  const chances = game.homeChances ?? [
    0.5,
    home > away ? 0.6 : 0.4,
    home > away ? 1 : home < away ? 0 : 0.5,
  ];
  return {
    items: chances.map((homeWinPercentage) => ({ homeWinPercentage })),
  };
}

/** The recap dataset's file for the season: each game given a recap, found. */
function recapDataset(games: LeagueGame[]) {
  return {
    season: SEASON,
    games: games.flatMap((game) =>
      game.recap
        ? [
            {
              season_type: "regular",
              week: game.week,
              away: game.away.abbreviation,
              home: game.home.abbreviation,
              status: "found",
              video: {
                youtube_id: game.recap,
                published_at: game.kickoff,
              },
            },
          ]
        : [],
    ),
  };
}

/**
 * Answers every request the pages make from `games`, the recap dataset
 * included; anything else is a 404. Returns the fetch mock.
 */
export function stubLeague(
  games: LeagueGame[],
): ReturnType<typeof vi.fn<typeof fetch>> {
  const regular = regularSeasonWeeks(SEASON);
  return stubFetch((url) => {
    const query = new URL(url).searchParams;
    if (url.includes("/standings")) return standings();
    if (url.includes("quiet-football-recap-data")) {
      return url.endsWith(`/${SEASON}.json`)
        ? recapDataset(games)
        : new Response(null, { status: 404 });
    }
    if (url.includes("/summary")) return { drives: {} };
    if (url.includes("/probabilities")) {
      const game = games.find(
        (entry) => entry.score && url.includes(`/events/${entry.id}/`),
      );
      return game ? probabilities(game) : new Response(null, { status: 404 });
    }
    if (url.includes("/scoreboard")) {
      const season = Number(query.get("dates"));
      const postseason = query.get("seasontype") === "3";
      const week = Number(query.get("week")) + (postseason ? regular : 0);
      return {
        season: { year: season, type: postseason ? 3 : 2 },
        week: { number: Number(query.get("week")) },
        events:
          season === SEASON
            ? games.filter((game) => game.week === week).map(event)
            : [],
      };
    }
    return new Response(null, { status: 404 });
  });
}
