import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";

/**
 * Whether the viewer has been shown the spoiler strip: on a first visit it
 * opens by itself once the season is in, and closing it or picking a week
 * ends that for good. Kept in the browser, not per season, so a returning
 * viewer is never shown it again.
 */
const store = createLocalStore<boolean>(
  "spoilers-introduced",
  z.boolean(),
  false,
);

export const subscribeToIntroduced = store.subscribe;
export const getIntroduced = store.get;
export const getServerIntroduced = store.getServer;
export const resetIntroducedCache = store.resetCache;

/** The strip has been shown; nothing to write if it already was. */
export function markIntroduced(): void {
  if (!store.get()) store.set(true);
}
