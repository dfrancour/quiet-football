/**
 * Kickoff dates and times, formatted for a time zone the caller names, so the
 * server and the browser agree on what they render.
 */

/** Where the NFL lists its kickoffs; the server renders in it. */
export const LEAGUE_TIME_ZONE = "America/New_York";

const LOCALE = "en-US";

function format(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(
    parsed,
  );
}

/** "Sun, Oct 11" */
export function formatShortDate(iso: string, timeZone: string): string | null {
  return format(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Sunday, Oct 11" */
export function formatLongDate(iso: string, timeZone: string): string | null {
  return format(iso, timeZone, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** "1:00 PM" */
export function formatTime(iso: string, timeZone: string): string | null {
  return format(iso, timeZone, { hour: "numeric", minute: "2-digit" });
}

/** "Sun, Oct 11, 1:00 PM" */
export function formatDateTime(iso: string, timeZone: string): string | null {
  return format(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The days from one kickoff to another: "Oct 15–19", "Oct 30 – Nov 2", or
 * "Feb 14" when both fall on one day.
 */
export function formatDayRange(
  firstIso: string,
  lastIso: string,
  timeZone: string,
): string | null {
  const month = (iso: string) => format(iso, timeZone, { month: "short" });
  const day = (iso: string) => format(iso, timeZone, { day: "numeric" });
  const first = format(firstIso, timeZone, { month: "short", day: "numeric" });
  const last = format(lastIso, timeZone, { month: "short", day: "numeric" });
  if (first === null || last === null) return first ?? last;
  if (first === last) return first;
  return month(firstIso) === month(lastIso)
    ? `${first}–${day(lastIso)}`
    : `${first} – ${last}`;
}

/** The calendar day in that zone, "2026-10-11", for grouping. */
export function dayKey(iso: string, timeZone: string): string | null {
  return format(iso, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
