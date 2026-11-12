import { parseWeekParam } from "~/lib/season-calendar";
import { FEEDS_URL } from "~/lib/site";

/**
 * The league is at `/` and a team at `/team/MIN`. A game is addressed by
 * season, team and week (`/team/SEA?season=2026&week=5`,
 * `?season=2026&week=wild-card`), never by id.
 */

export function standingsPath(): string {
  return "/";
}

export function aboutPath(): string {
  return "/about";
}

/** A week of a season, as a team page's URL names it (`weekParam()`). */
export interface WeekAt {
  season: number;
  week: string;
}

/**
 * A team's page, optionally opened on its game in one week. The season is
 * named too, so a link kept past the season it was made in does not open on
 * the next one's game that week.
 */
export function teamPath(abbreviation: string, at?: WeekAt): string {
  const path = `/team/${abbreviation.toUpperCase()}`;
  return at === undefined
    ? path
    : `${path}?season=${at.season}&week=${at.week}`;
}

/** A team's Atom feed of game recaps, off the site (`/nfl/min.atom`). */
export function teamFeedUrl(abbreviation: string): string {
  return `${FEEDS_URL}/${abbreviation.toLowerCase()}.atom`;
}

/**
 * The week a team page's URL opens on, if it names one of the season shown.
 * Only one season is shown, so a week of any other names no game here and
 * the page opens on its default. A URL with no season is taken to mean the
 * one shown.
 */
export function weekFromQuery(
  query: Pick<URLSearchParams, "get">,
  season: number,
  totalWeeks: number,
): number | null {
  const named = query.get("season");
  if (named !== null && named !== String(season)) return null;
  return parseWeekParam(totalWeeks, query.get("week") ?? undefined);
}
