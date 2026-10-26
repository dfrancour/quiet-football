export type GameStatus =
  | "scheduled"
  | "in_progress"
  | "final"
  | "postponed"
  | "canceled";

export type GameOutcome = "win" | "loss" | "tie";

export interface Venue {
  name: string | null;
  city: string | null;
  state: string | null;
}

export interface GameSide {
  teamId: string;
  score: number | null;
  /** Points per period, overtime included. Absent until the game has started. */
  periods?: number[];
}

/** Held once for the league; per-team schedules are derived from it. */
export interface SeasonGame {
  /** ESPN's event id. */
  gameId: string;
  week: number;
  kickoff: string;
  status: GameStatus;
  neutralSite: boolean;
  broadcast: string | null;
  venue: Venue;
  home: GameSide;
  away: GameSide;
}

/** The regular season's games, then the playoffs' (`season-calendar.ts`). */
export interface SeasonFile {
  season: number;
  /** Regular-season weeks; playoff rounds follow as weeks after them. */
  totalWeeks: number;
  games: SeasonGame[];
}
