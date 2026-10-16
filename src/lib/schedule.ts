import { type TeamRecord } from "~/lib/season";
import { ROUND_NAMES } from "~/lib/season-calendar";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";

export type { TeamRecord };

export const PREGAME_WINDOW_MS = 3 * 60 * 60 * 1000;

/** How long a finished game stays the headline. */
export const RECAP_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

export type GamePhase =
  | "upcoming"
  | "pregame"
  | "live"
  | "final"
  | "postponed"
  | "canceled";

export type ScheduleState =
  | { kind: "live"; game: TeamGame }
  | { kind: "pregame"; game: TeamGame; msUntilKickoff: number }
  | { kind: "recap"; game: TeamGame }
  | { kind: "upcoming"; game: TeamGame; msUntilKickoff: number }
  | { kind: "offseason" };

/** "just now", "12s ago", "3m ago". */
export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

type Scheduled = Pick<TeamGame, "status" | "kickoff">;

export function kickoffMs(game: Scheduled): number {
  return Date.parse(game.kickoff);
}

/**
 * Only ESPN's scoreboard calls a game final. Up to then the clock decides, so
 * a game reads as live from kickoff before the scoreboard says so, and stays
 * live however long it runs.
 */
export function gamePhase(game: Scheduled, now: number): GamePhase {
  if (game.status === "postponed") return "postponed";
  if (game.status === "canceled") return "canceled";
  if (game.status === "final") return "final";
  if (game.status === "in_progress") return "live";

  const kickoff = kickoffMs(game);
  if (Number.isNaN(kickoff)) return "upcoming";

  if (now < kickoff - PREGAME_WINDOW_MS) return "upcoming";
  if (now < kickoff) return "pregame";
  return "live";
}

function byKickoff(a: TeamGame, b: TeamGame): number {
  return kickoffMs(a) - kickoffMs(b);
}

/** The game to lead with: live, else pregame, else recent final, else next. */
export function deriveScheduleState(
  schedule: TeamSchedule,
  now: number,
): ScheduleState {
  const games = [...schedule.games].sort(byKickoff);

  const live = games.find((game) => gamePhase(game, now) === "live");
  if (live) return { kind: "live", game: live };

  const pregame = games.find((game) => gamePhase(game, now) === "pregame");
  if (pregame) {
    return {
      kind: "pregame",
      game: pregame,
      msUntilKickoff: kickoffMs(pregame) - now,
    };
  }

  const recap = [...games]
    .reverse()
    .find(
      (game) =>
        gamePhase(game, now) === "final" &&
        now >= kickoffMs(game) &&
        now - kickoffMs(game) <= RECAP_WINDOW_MS,
    );
  if (recap) return { kind: "recap", game: recap };

  const upcoming = games.find((game) => gamePhase(game, now) === "upcoming");
  if (upcoming) {
    return {
      kind: "upcoming",
      game: upcoming,
      msUntilKickoff: kickoffMs(upcoming) - now,
    };
  }

  return { kind: "offseason" };
}

/**
 * The game a team page opens on: live, then imminent, then just played, then
 * next; out of season, the latest. Without a clock, the latest.
 */
export function defaultGameId(
  schedule: TeamSchedule,
  now: number | null,
): string | null {
  const state = now === null ? null : deriveScheduleState(schedule, now);
  if (state && state.kind !== "offseason") return state.game.gameId;
  const last = [...schedule.games].sort(
    (a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff),
  )[0];
  return last?.gameId ?? null;
}

/** The regular-season record; playoff games do not count. */
export function teamRecord(games: readonly TeamGame[]): TeamRecord {
  return games.reduce<TeamRecord>(
    (record, game) => {
      if (game.status !== "final" || !game.result || game.round !== null) {
        return record;
      }
      switch (game.result.outcome) {
        case "win":
          return { ...record, wins: record.wins + 1 };
        case "loss":
          return { ...record, losses: record.losses + 1 };
        case "tie":
          return { ...record, ties: record.ties + 1 };
      }
    },
    { wins: 0, losses: 0, ties: 0 },
  );
}

export function formatRecord(record: TeamRecord): string {
  const base = `${record.wins}-${record.losses}`;
  return record.ties > 0 ? `${base}-${record.ties}` : base;
}

/** "Week 5", or the playoff round's name. */
export function weekLabel(game: Pick<TeamGame, "week" | "round">): string {
  return game.round ? ROUND_NAMES[game.round] : `Week ${game.week}`;
}

export function matchupLabel(game: TeamGame): string {
  const prefix = game.homeAway === "home" ? "vs" : "at";
  return `${prefix} ${game.opponent.abbreviation}`;
}

/** Null once kickoff has passed. */
export function formatCountdown(msUntilKickoff: number): string | null {
  if (msUntilKickoff <= 0) return null;

  const totalMinutes = Math.floor(msUntilKickoff / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
