"use client";

import { useSyncExternalStore } from "react";
import {
  getClockSnapshot,
  getServerClockSnapshot,
  subscribeToClock,
} from "~/lib/clock";

/**
 * The current time, or null before the shared clock has started, so the
 * server render does not depend on the viewer's clock.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
}
