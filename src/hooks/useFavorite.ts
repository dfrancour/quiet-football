"use client";

import { useSyncExternalStore } from "react";
import {
  getFavorite,
  getServerFavorite,
  subscribeToFavorite,
} from "~/lib/favorite";

/** The favorite team's abbreviation; null for none. */
export function useFavorite(): string | null {
  return useSyncExternalStore(
    subscribeToFavorite,
    getFavorite,
    getServerFavorite,
  );
}
