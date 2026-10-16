import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";
import { formatGameClock } from "~/lib/score";
import { type LiveScore } from "~/lib/score.schema";
import { type GameOutcome } from "~/lib/season.schema";
import { type TeamGame } from "~/lib/team-view";

/**
 * By season, the last week the viewer is caught up through: everything up to
 * it is shown. A season it does not name is caught up through nothing. Kept
 * in the browser; it names only weeks the viewer said they were done with,
 * so it does not expire. Anything unreadable reads as caught up through
 * nothing.
 */
export type CaughtUp = Readonly<Record<string, number>>;

const store = createLocalStore<CaughtUp>(
  "caught-up",
  z.record(z.string(), z.number().int().nonnegative()),
  {},
);

export const subscribeToCaughtUp = store.subscribe;
export const getCaughtUp = store.get;
export const getServerCaughtUp = store.getServer;
export const resetCaughtUpCache = store.resetCache;

/** Caught up through `week` of `season` (0 for nothing); other seasons keep theirs. */
export function catchUpThrough(season: number, week: number): void {
  const others = Object.entries(store.get()).filter(
    ([key]) => key !== String(season),
  );
  store.set(
    Object.fromEntries(week > 0 ? [...others, [season, week]] : others),
  );
}

/**
 * The records going into a game in `week` say how every earlier week went;
 * a playoff game's, how the regular season ended.
 */
export function recordsShownBefore(
  week: number,
  through: number,
  totalWeeks: number,
): boolean {
  return through >= Math.min(week - 1, totalWeeks);
}

/** Null while hidden, for the caller to cover with `Redacted`. */
export function maskedScore(
  score: number | null,
  showSpoilers: boolean,
): string | null {
  if (!showSpoilers) return null;
  return score === null ? "--" : String(score);
}

/**
 * Overtime reveals a tie after regulation, so with spoilers hidden a game
 * reads "Q4+" from the fourth quarter on (so nothing changes when regulation
 * ends) and "Final", never "Final/OT", once over.
 */
export function spoilerSafeClock(
  score: Pick<LiveScore, "detail" | "period" | "clock" | "completed">,
  showSpoilers: boolean,
): string {
  if (showSpoilers) return formatGameClock(score);
  if (score.completed) return "Final";
  if (score.period !== null && score.period >= 4) return "Q4+";
  return formatGameClock(score);
}

export type ResultVisibility =
  | { kind: "upcoming" }
  | { kind: "label"; text: string }
  | {
      kind: "result";
      teamScore: number;
      opponentScore: number;
      outcome: GameOutcome;
    };

/**
 * What a schedule row may reveal. Hidden, a played game reads "Final" only:
 * the win/loss letter spoils as much as the score.
 */
export function resultVisibility(
  game: TeamGame,
  showSpoilers: boolean,
): ResultVisibility {
  if (game.status === "postponed") return { kind: "label", text: "Postponed" };
  if (game.status === "canceled") return { kind: "label", text: "Canceled" };

  if (game.status !== "final") return { kind: "upcoming" };
  if (!game.result || !showSpoilers) return { kind: "label", text: "Final" };

  return {
    kind: "result",
    teamScore: game.result.teamScore,
    opponentScore: game.result.opponentScore,
    outcome: game.result.outcome,
  };
}
