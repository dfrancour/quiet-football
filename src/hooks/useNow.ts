"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getClockSnapshot,
  getServerClockSnapshot,
  subscribeToClock,
} from "~/lib/clock";

/**
 * The current time, or null before the shared clock has started, so the
 * server render does not depend on the viewer's clock. It changes once a
 * second, or every `everyMs` for a reader that needs it less often.
 */
export function useNow(everyMs?: number): number | null {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToClock(listener, everyMs),
    [everyMs],
  );
  return useSyncExternalStore(
    subscribe,
    getClockSnapshot,
    getServerClockSnapshot,
  );
}
