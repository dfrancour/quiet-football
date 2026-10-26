import { useSyncExternalStore } from "react";

/** For `useSyncExternalStore`: a store that never changes. */
export function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * A value only the browser knows that holds while the page is open (its time
 * zone, what its CSS supports): `server` in the prerendered markup and through
 * hydration, so they match, then `browser`. Each must return the same value
 * every call.
 */
export function useBrowserValue<T>(browser: () => T, server: () => T): T {
  return useSyncExternalStore(subscribeToNothing, browser, server);
}
