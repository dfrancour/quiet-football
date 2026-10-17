"use client";

import { useSyncExternalStore } from "react";
import {
  getIntroduced,
  getServerIntroduced,
  subscribeToIntroduced,
} from "~/lib/first-run";

/** Whether the viewer has been shown the spoiler strip. */
export function useIntroduced(): boolean {
  return useSyncExternalStore(
    subscribeToIntroduced,
    getIntroduced,
    getServerIntroduced,
  );
}
