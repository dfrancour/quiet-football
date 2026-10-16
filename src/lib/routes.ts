/**
 * The league is at `/` and a team at `/team/MIN`. A game is addressed by team
 * and week (`/team/SEA?week=5`, `/team/SEA?week=wild-card`), never by id.
 */

export function standingsPath(): string {
  return "/";
}

export function aboutPath(): string {
  return "/about";
}

/**
 * A team's page, optionally opened on its game in one week, as `weekParam()`
 * names it (a playoff week by its round).
 */
export function teamPath(abbreviation: string, week?: string): string {
  const path = `/team/${abbreviation.toUpperCase()}`;
  return week === undefined ? path : `${path}?week=${week}`;
}
