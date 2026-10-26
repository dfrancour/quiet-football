import {
  queryOptions,
  type QueryClient,
  type QueryState,
} from "@tanstack/react-query";
import { scoreConfig } from "~/lib/config";
import { noteGameClock } from "~/lib/game-clocks";
import { noteSituations } from "~/lib/game-situations";
import { notePlayArrivals } from "~/lib/play-arrivals";
import { playoffMarksFromEspn } from "~/lib/playoff-marks";
import { type PlayoffMarks } from "~/lib/playoff-marks.schema";
import { readSummary, SUMMARY_URL } from "~/lib/plays";
import { type PlayByPlay } from "~/lib/plays.schema";
import { fetchRecapDataset } from "~/lib/recap-dataset";
import {
  playoffRound,
  regularSeasonWeeks,
  seasonWeeks,
} from "~/lib/season-calendar";
import {
  readWeek,
  weekActivity,
  weekScoreboardUrl,
  type WeekBoard,
} from "~/lib/season-sync";
import { type TeamRegistry } from "~/lib/teams.schema";
import {
  fetchStandings,
  teamColors,
  teamRegistryFromEspn,
} from "~/lib/team-fetch";
import { kickoffMs } from "~/lib/schedule";
import { fetchUpstream, retryAfterOf } from "~/lib/upstream";
import { savedTeams, savedWeek, saveTeams, saveWeek } from "~/lib/week-store";

/**
 * Everything the app reads, as TanStack Query options: ESPN and the recap
 * dataset are fetched from the browser. Each query names how long its answer
 * is trusted and whether it is polled, so only a week with a game under way,
 * or a game being watched, is fetched again on its own; what a visit can
 * leave for the next it saves (`week-store.ts`).
 */

/**
 * How often a poll runs: its base, doubled for each failure in a row up to
 * a limit, and never sooner than the source asked (`Retry-After`), so a
 * source in trouble is not pressed.
 */
function pollEvery(
  baseMs: number,
  state: { fetchFailureCount: number; fetchFailureReason: unknown },
): number {
  const doublings = Math.min(
    state.fetchFailureCount,
    scoreConfig.pollBackoffDoublings,
  );
  return Math.max(
    baseMs * 2 ** doublings,
    retryAfterOf(state.fetchFailureReason) ?? 0,
  );
}

/**
 * ESPN's standings for a season, every team under its division. One payload
 * serves the team registry and the playoff marks; it is trusted for a while
 * and kept for the session.
 */
export function standingsQuery(season: number) {
  return queryOptions({
    queryKey: ["standings", season],
    queryFn: ({ signal }) => fetchStandings(season, signal),
    staleTime: scoreConfig.marksStaleMs,
    gcTime: Infinity,
  });
}

/**
 * The 32 teams, once a session, and saved for a week of visits: ESPN's
 * standings name them under their divisions, and the season's first week,
 * in which every team plays, gives each its colors.
 */
export function teamsQuery(season: number) {
  return queryOptions({
    queryKey: ["teams", season],
    queryFn: async ({ client }): Promise<TeamRegistry> => {
      const at = Date.now();
      const saved = savedTeams(season);
      if (saved && at - saved.savedAt < scoreConfig.teamsStaleMs) {
        return saved.registry;
      }
      const [standings, opener] = await Promise.all([
        client.ensureQueryData(standingsQuery(season)),
        client.ensureQueryData(weekQuery(season, 1)),
      ]);
      const registry = teamRegistryFromEspn(
        standings,
        teamColors(opener.payload),
      );
      saveTeams(season, registry, at);
      return registry;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export interface LoadedBoard extends WeekBoard {
  /** When this scoreboard arrived from ESPN, this visit or an earlier one. */
  fetchedAt: number;
  /**
   * A playoff round whose week before is not yet settled: empty, and not
   * asked of ESPN until that week is.
   */
  waiting: boolean;
}

/** Whether a saved week still stands in for ESPN. */
function savedStillGood(board: WeekBoard, savedAt: number, at: number) {
  switch (weekActivity(board.games, at)) {
    case "settled":
      return true;
    case "ahead":
      return at - savedAt < scoreConfig.aheadStaleMs;
    case "live":
      return false;
  }
}

/**
 * Whether a playoff round can have its matchups yet: they come from the
 * week before it (the Wild Card's from Week 18), so until that week is
 * settled the round is empty, and ESPN need not be asked to say so. A
 * regular-season week always can.
 */
async function roundIsSet(
  client: QueryClient,
  season: number,
  week: number,
): Promise<boolean> {
  if (!playoffRound(regularSeasonWeeks(season), week)) return true;
  const before = await client.ensureQueryData(weekQuery(season, week - 1));
  return weekActivity(before.games, Date.now()) === "settled";
}

/**
 * One week's scoreboard. A week saved by an earlier visit stands in for ESPN
 * while it is good: for good once settled, for `aheadStaleMs` while ahead.
 * Fetched, it is saved for the next visit unless a game in it is under way.
 */
async function fetchWeek(
  client: QueryClient,
  season: number,
  week: number,
  signal: AbortSignal,
): Promise<LoadedBoard> {
  const at = Date.now();
  if (!(await roundIsSet(client, season, week))) {
    // Still waiting, the board is kept as it was, so nothing re-renders.
    const before = client.getQueryData<LoadedBoard>(weekKey(season, week));
    if (before?.waiting) return before;
    return {
      ...readWeek(season, week, { events: [] }),
      fetchedAt: at,
      waiting: true,
    };
  }
  const saved = savedWeek(season, week);
  if (saved) {
    const board = readWeek(season, week, saved.payload);
    if (savedStillGood(board, saved.savedAt, at)) {
      for (const game of board.board) noteGameClock(game.gameId, game, at);
      return { ...board, fetchedAt: saved.savedAt, waiting: false };
    }
  }
  const board = readWeek(
    season,
    week,
    await fetchUpstream(weekScoreboardUrl(season, week), signal),
  );
  // Noted as each poll lands, so a delayed broadcast can be shown its moment,
  // and a viewer at a play the game as it stood after it.
  for (const game of board.board) noteGameClock(game.gameId, game, at);
  noteSituations(board.payload);
  if (weekActivity(board.games, at) !== "live") {
    saveWeek(season, week, board.payload, at);
  }
  return { ...board, fetchedAt: at, waiting: false };
}

function weekKey(season: number, week: number) {
  return ["week", season, week] as const;
}

/**
 * One week's scoreboard, playoff rounds included. Settled, it is never
 * fetched again; with a game under way it is polled; ahead, it is trusted
 * for hours from when it arrived, long enough to pick up a flexed game, and
 * asked for again as its next game kicks off, so an open page starts
 * polling it. A playoff round is asked for only once the week before it is
 * settled; until then it reads the week before from the cache as often as a
 * live week is polled, which costs ESPN nothing.
 *
 * A page that was hidden when one of these fell due catches up on its
 * return: only a week its policy calls stale is fetched then.
 */
export function weekQuery(season: number, week: number) {
  return queryOptions({
    queryKey: weekKey(season, week),
    queryFn: ({ client, signal }) => fetchWeek(client, season, week, signal),
    staleTime: (query) => weekStaleMs(query.state, Date.now()),
    refetchInterval: (query) => weekPollMs(query.state, Date.now()),
    refetchOnWindowFocus: true,
  });
}

/** What a week's policy reads of its query. */
type WeekState = Pick<
  QueryState<LoadedBoard>,
  "data" | "dataUpdatedAt" | "fetchFailureCount" | "fetchFailureReason"
>;

/** How long a week is fresh, counted as Query counts: from `dataUpdatedAt`. */
export function weekStaleMs({ data, dataUpdatedAt }: WeekState, now: number) {
  if (!data || data.waiting) return 0;
  switch (weekActivity(data.games, now)) {
    case "live":
      return 0;
    case "settled":
      return Infinity;
    case "ahead":
      // The trust counts from when it arrived from ESPN, perhaps on an
      // earlier visit, not from when it landed in the cache.
      return Math.max(
        0,
        scoreConfig.aheadStaleMs - (dataUpdatedAt - data.fetchedAt),
      );
  }
}

/** How long until a week is asked for again on its own, or never. */
export function weekPollMs(state: WeekState, now: number): number | false {
  const { data } = state;
  if (!data) return false;
  if (data.waiting) return scoreConfig.livePollMs;
  switch (weekActivity(data.games, now)) {
    case "live":
      return pollEvery(scoreConfig.livePollMs, state);
    case "settled":
      return false;
    case "ahead": {
      const due = Math.min(
        data.fetchedAt + scoreConfig.aheadStaleMs,
        ...data.games.map(kickoffMs).filter((kickoff) => kickoff > now),
      );
      return pollEvery(Math.max(due - now, scoreConfig.livePollMs), state);
    }
  }
}

/** Every week of a season, regular season then playoff rounds. */
export function weekQueries(season: number, totalWeeks: number) {
  return Array.from({ length: seasonWeeks(totalWeeks) }, (_, index) =>
    weekQuery(season, index + 1),
  );
}

/**
 * A game's play-by-play from ESPN's summary, trimmed as it arrives since the
 * payload is hundreds of kilobytes, mostly not plays. A finished game's is
 * fetched once. A live game's is read again as the week's scoreboard shows
 * a new play (`usePlayByPlay`), with a slow poll behind that in case the
 * scoreboard missed one.
 */
export function playByPlayQuery(gameId: string, live: boolean) {
  return queryOptions({
    queryKey: ["play-by-play", gameId],
    queryFn: async ({ signal }): Promise<PlayByPlay> => {
      const { drives, final } = readSummary(
        await fetchUpstream(`${SUMMARY_URL}?event=${gameId}`, signal),
      );
      notePlayArrivals(gameId, drives, Date.now());
      return { gameId, drives, final };
    },
    staleTime: (query) => (query.state.data?.final ? Infinity : 0),
    refetchInterval: (query) =>
      live && !query.state.data?.final
        ? pollEvery(scoreConfig.summaryFallbackMs, query.state)
        : false,
    gcTime: scoreConfig.summaryKeepMs,
  });
}

/** One reader per season, so Query reuses its result between renders. */
const marksReaders = new Map<number, (payload: unknown) => PlayoffMarks>();

/** ESPN's playoff seeds and clinch codes, read off the season's standings. */
export function playoffMarksQuery(season: number) {
  let read = marksReaders.get(season);
  if (!read) {
    read = (payload) =>
      playoffMarksFromEspn(season, payload, new Date().toISOString());
    marksReaders.set(season, read);
  }
  return queryOptions({ ...standingsQuery(season), select: read });
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
