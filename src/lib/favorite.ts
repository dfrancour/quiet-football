import { z } from "zod";
import { createLocalStore } from "~/lib/local-store";

const abbreviationSchema = z.string().regex(/^[A-Za-z]{2,4}$/);

/**
 * The favorite teams' abbreviations, kept in the browser, in the order they
 * were starred; empty for none. A lone abbreviation reads as a list of one.
 * The caller resolves them against the registry, so an unknown one marks
 * nothing.
 */
const store = createLocalStore<readonly string[]>(
  "favorite-team",
  z.union([
    z.array(abbreviationSchema),
    abbreviationSchema.transform((abbreviation) => [abbreviation]),
    z.null().transform(() => []),
  ]),
  [],
);

export const subscribeToFavorites = store.subscribe;
export const getFavorites = store.get;
export const getServerFavorites = store.getServer;
export const resetFavoritesCache = store.resetCache;

/** Stars or unstars a team, leaving the other favorites as they are. */
export function setFavorite(abbreviation: string, on: boolean): void {
  const team = abbreviation.toUpperCase();
  const others = getFavorites().filter((favorite) => favorite !== team);
  store.set(on ? [...others, team] : others);
}
