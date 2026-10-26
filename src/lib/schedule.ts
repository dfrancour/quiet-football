import { addOutcome, NO_RECORD, type TeamRecord } from "~/lib/season";
import { ROUND_NAMES } from "~/lib/season-calendar";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";

export type { TeamRecord };

export const PREGAME_WINDOW_MS = 3 * 60 * 60 * 1000;

/** How long a finished game stays the one a team page opens on. */
export const JUST_PLAYED_MS = 4 * 24 * 60 * 60 * 1000;

export type GamePhase =
  | "upcoming"
  | "pregame"
  | "live"
  | "final"
  | "postponed"
  | "canceled";

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

/**
 * The game a team page opens on: live, then imminent (`pregame`), then just
 * played (within `JUST_PLAYED_MS`), then next; out of season, the latest.
 * Without a clock, the latest.
 */
export function defaultGameId(
  schedule: TeamSchedule,
  now: number | null,
): string | null {
  const games = [...schedule.games].sort(byKickoff);
  const latest = games.at(-1)?.gameId ?? null;
  if (now === null) return latest;
  const phased = (phase: GamePhase) =>
    games.find((game) => gamePhase(game, now) === phase);
  const justPlayed = games.findLast(
    (game) =>
      gamePhase(game, now) === "final" &&
      now >= kickoffMs(game) &&
      now - kickoffMs(game) <= JUST_PLAYED_MS,
  );
  return (
    (phased("live") ?? phased("pregame") ?? justPlayed ?? phased("upcoming"))
      ?.gameId ?? latest
  );
}

/** The regular-season record; playoff games do not count. */
export function teamRecord(games: readonly TeamGame[]): TeamRecord {
  return games.reduce(
    (record, game) =>
      game.status === "final" && game.result && game.round === null
        ? addOutcome(record, game.result.outcome)
        : record,
    NO_RECORD,
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
