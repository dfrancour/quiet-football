import { queryOptions } from "@tanstack/react-query";
import { scoreConfig } from "~/lib/config";
import { noteGameClock } from "~/lib/game-clocks";
import { notePlayArrivals } from "~/lib/play-arrivals";
import { fetchPlayoffMarks } from "~/lib/playoff-marks";
import { extractPlayByPlay, SUMMARY_URL, summaryIsFinal } from "~/lib/plays";
import { type PlayByPlay } from "~/lib/plays.schema";
import { fetchRecapDataset } from "~/lib/recap-dataset";
import { seasonWeeks } from "~/lib/season-calendar";
import {
  readWeek,
  weekActivity,
  weekScoreboardUrl,
  type WeekBoard,
} from "~/lib/season-sync";
import {
  fetchStandings,
  teamColors,
  teamRegistryFromEspn,
} from "~/lib/team-fetch";
import { fetchUpstream } from "~/lib/upstream";

/**
 * Everything the app reads, as TanStack Query options: ESPN and the recap
 * dataset are fetched from the browser, with nothing kept past the session.
 * Each query names how long its answer is trusted and whether it is polled,
 * so only a week with a game under way, or a game being watched, is fetched
 * again on its own.
 */

/**
 * The 32 teams, once a session: ESPN's standings name them under their
 * divisions, and the season's first week, in which every team plays, gives
 * each its color.
 */
export function teamsQuery(season: number) {
  return queryOptions({
    queryKey: ["teams", season],
    queryFn: async ({ signal, client }) => {
      const [standings, opener] = await Promise.all([
        fetchStandings(signal),
        client.ensureQueryData(weekQuery(season, 1)),
      ]);
      return teamRegistryFromEspn(standings, teamColors(opener.payload));
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

async function fetchWeek(
  season: number,
  week: number,
  signal: AbortSignal,
): Promise<WeekBoard> {
  const board = readWeek(
    season,
    week,
    await fetchUpstream(weekScoreboardUrl(season, week), signal),
  );
  // Noted as each poll lands, so a delayed broadcast can be shown its moment.
  const at = Date.now();
  for (const game of board.board) noteGameClock(game.gameId, game, at);
  return board;
}

/**
 * One week's scoreboard, playoff rounds included. Settled, it is never
 * fetched again; with a game under way it is polled; ahead, it is trusted
 * for hours, long enough to pick up a flexed game.
 */
export function weekQuery(season: number, week: number) {
  return queryOptions({
    queryKey: ["week", season, week],
    queryFn: ({ signal }) => fetchWeek(season, week, signal),
    staleTime: (query) => {
      const games = query.state.data?.games ?? [];
      switch (weekActivity(games, Date.now())) {
        case "live":
          return 0;
        case "settled":
          return Infinity;
        case "ahead":
          return scoreConfig.aheadStaleMs;
      }
    },
    refetchInterval: (query) => {
      const games = query.state.data?.games ?? [];
      return weekActivity(games, Date.now()) === "live"
        ? scoreConfig.livePollMs
        : false;
    },
  });
}

/** Every week of a season, regular season then playoff rounds. */
export function weekQueries(season: number, totalWeeks: number) {
  return Array.from({ length: seasonWeeks(totalWeeks) }, (_, index) =>
    weekQuery(season, index + 1),
  );
}

export interface LoadedPlayByPlay extends PlayByPlay {
  /** Whether ESPN's summary calls the game over. */
  final: boolean;
}

/**
 * A game's play-by-play from ESPN's summary, trimmed as it arrives since the
 * payload is hundreds of kilobytes, mostly not plays. Polled while the game
 * is under way; a finished game's is fetched once.
 */
export function playByPlayQuery(gameId: string, live: boolean) {
  return queryOptions({
    queryKey: ["play-by-play", gameId],
    queryFn: async ({ signal }): Promise<LoadedPlayByPlay> => {
      const payload = await fetchUpstream(
        `${SUMMARY_URL}?event=${gameId}`,
        signal,
      );
      const drives = extractPlayByPlay(payload);
      notePlayArrivals(gameId, drives, Date.now());
      return { gameId, drives, final: summaryIsFinal(payload) };
    },
    staleTime: (query) => (query.state.data?.final ? Infinity : 0),
    refetchInterval: (query) =>
      live && !query.state.data?.final ? scoreConfig.livePollMs : false,
    gcTime: scoreConfig.summaryKeepMs,
  });
}

/** ESPN's playoff seeds and clinch codes, trusted for a while. */
export function playoffMarksQuery(season: number) {
  return queryOptions({
    queryKey: ["playoff-marks", season],
    queryFn: ({ signal }) => fetchPlayoffMarks(season, signal),
    staleTime: scoreConfig.marksStaleMs,
  });
}

/**
 * A season's file from football-recaps-data. The caller polls it while a
 * recent game is still waiting on its recap (`useRecaps`).
 */
export function recapDatasetQuery(season: number) {
  return queryOptions({
    queryKey: ["recaps", season],
    queryFn: ({ signal }) => fetchRecapDataset(season, signal),
  });
}
