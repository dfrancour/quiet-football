import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";

/**
 * The favorite team's abbreviation, kept in the browser; null for none. The
 * caller resolves it against the registry, so an unknown one marks nothing.
 */
const store = createLocalStore<string | null>(
  "favorite-team",
  z
    .string()
    .regex(/^[A-Za-z]{2,4}$/)
    .nullable(),
  null,
);

export const subscribeToFavorite = store.subscribe;
export const getFavorite = store.get;
export const getServerFavorite = store.getServer;
export const resetFavoriteCache = store.resetCache;

/** Sets the one favorite; null clears it. */
export function setFavorite(abbreviation: string | null): void {
  store.set(abbreviation?.toUpperCase() ?? null);
}
