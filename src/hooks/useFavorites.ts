"use client";

import { useSyncExternalStore } from "react";
import {
  getFavorites,
  getServerFavorites,
  subscribeToFavorites,
} from "~/lib/favorite";

/** The favorite teams' abbreviations; empty for none. */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(
    subscribeToFavorites,
    getFavorites,
    getServerFavorites,
  );
}
