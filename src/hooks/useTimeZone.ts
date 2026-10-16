"use client";

import { useSyncExternalStore } from "react";
import { LEAGUE_TIME_ZONE } from "~/lib/dates";

const subscribeToNothing = () => () => {};
const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || LEAGUE_TIME_ZONE;
const serverTimeZone = () => LEAGUE_TIME_ZONE;

/**
 * The viewer's time zone. The server renders in the league's, and hydration
 * keeps it, so the markup matches before the browser's takes over.
 */
export function useTimeZone(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    browserTimeZone,
    serverTimeZone,
  );
}
