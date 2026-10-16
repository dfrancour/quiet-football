/** A season is named for its kickoff year; Jan and Feb belong to the prior. */
export function currentSeason(now: number): number {
  const date = new Date(now);
  return date.getUTCMonth() < 2
    ? date.getUTCFullYear() - 1
    : date.getUTCFullYear();
}

/** Regular-season weeks: 17 through 2020, 18 since. */
export function regularSeasonWeeks(season: number): number {
  return season >= 2021 ? 18 : 17;
}

/**
 * The postseason in order. Each round is stored as a week after the regular
 * season (Wild Card is week 19 of an 18-week season), so a team still plays
 * once a week; URLs name the round instead.
 */
export const PLAYOFF_ROUNDS = [
  "wild-card",
  "divisional",
  "conference",
  "super-bowl",
] as const;

export type PlayoffRound = (typeof PLAYOFF_ROUNDS)[number];

export const ROUND_NAMES: Readonly<Record<PlayoffRound, string>> = {
  "wild-card": "Wild Card",
  divisional: "Divisional Round",
  conference: "Conference Championship",
  "super-bowl": "Super Bowl",
};

export const ROUND_ABBREVIATIONS: Readonly<Record<PlayoffRound, string>> = {
  "wild-card": "WC",
  divisional: "DIV",
  conference: "CONF",
  "super-bowl": "SB",
};

/** Null for a regular-season week. */
export function playoffRound(
  totalWeeks: number,
  week: number,
): PlayoffRound | null {
  return PLAYOFF_ROUNDS[week - totalWeeks - 1] ?? null;
}

export function playoffWeek(totalWeeks: number, round: PlayoffRound): number {
  return totalWeeks + PLAYOFF_ROUNDS.indexOf(round) + 1;
}

/** Every week of a season, postseason included. */
export function seasonWeeks(totalWeeks: number): number {
  return totalWeeks + PLAYOFF_ROUNDS.length;
}

/** "Week 5", or the round's name. */
export function weekName(totalWeeks: number, week: number): string {
  const round = playoffRound(totalWeeks, week);
  return round ? ROUND_NAMES[round] : `Week ${week}`;
}

/** A week as a URL names it: its number, or its round (`wild-card`). */
export function weekParam(totalWeeks: number, week: number): string {
  return playoffRound(totalWeeks, week) ?? String(week);
}

/** The week a URL names, if it is one. */
export function parseWeekParam(
  totalWeeks: number,
  value: string | undefined,
): number | null {
  if (value === undefined) return null;
  const round = PLAYOFF_ROUNDS.find((entry) => entry === value);
  if (round) return playoffWeek(totalWeeks, round);
  const week = Number(value);
  return Number.isInteger(week) && week >= 1 && week <= totalWeeks
    ? week
    : null;
}
