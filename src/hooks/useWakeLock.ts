"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while `active`, so a replay playing out on a phone
 * left on the table does not dim and lock. The browser lets go of the lock
 * whenever the page is hidden, so it is asked for again each time the page
 * comes back. A browser without the API, or one that refuses (battery
 * saver), simply lets the screen sleep.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    let done = false;

    const request = () => {
      if (lock || requesting || document.visibilityState !== "visible") return;
      requesting = true;
      navigator.wakeLock.request("screen").then(
        (sentinel) => {
          requesting = false;
          if (done) {
            sentinel.release().catch(() => {});
            return;
          }
          lock = sentinel;
          sentinel.addEventListener("release", () => {
            if (lock === sentinel) lock = null;
          });
        },
        () => {
          requesting = false;
        },
      );
    };

    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}
