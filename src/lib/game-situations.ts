import { teamSituation, type Competition } from "~/lib/score";
import { scoreboardSchema, type SituationState } from "~/lib/score.schema";

/**
 * By game, then by the play the scoreboard last named, the game as the
 * scoreboard left it after that play: where the ball is, the down, who has
 * it, the timeouts. A viewer at that play can be shown it before the next
 * play is known, however far the scoreboard has moved on since: a delayed
 * broadcast, or play-by-play still catching up. Kept for the visit.
 */
const after = new Map<string, Map<string, Competition>>();

/** Notes each game's situation on a scoreboard, against its last play. */
export function noteSituations(payload: unknown): void {
  const parsed = scoreboardSchema.safeParse(payload);
  if (!parsed.success) return;
  for (const event of parsed.data.events ?? []) {
    const competition = event.competitions?.[0];
    const playId = competition?.situation?.lastPlay?.id;
    if (!competition || playId === null || playId === undefined) continue;
    const gameId = String(event.id);
    const byPlay = after.get(gameId) ?? new Map<string, Competition>();
    // The newest word on a play wins: ESPN may respot it.
    byPlay.set(String(playId), competition);
    after.set(gameId, byPlay);
  }
}

/** The game after `playId`, from a team's side; null if never noted. */
export function situationAfter(
  gameId: string,
  playId: string,
  teamAbbreviation: string,
): SituationState | null {
  const competition = after.get(gameId)?.get(playId);
  return competition ? teamSituation(competition, teamAbbreviation) : null;
}

/** For tests: forget every situation. */
export function resetGameSituations(): void {
  after.clear();
}
