import "@testing-library/jest-dom";
import type * as Navigation from "next/navigation";
import { afterEach, vi } from "vitest";
import { resetBroadcastDelaysCache } from "~/lib/broadcast-delay";
import { resetFavoritesCache } from "~/lib/favorite";
import { resetGameClocks } from "~/lib/game-clocks";
import { resetPlayArrivals } from "~/lib/play-arrivals";
import { resetCaughtUpCache, resetShowAllCache } from "~/lib/spoilers";
import { resetWatchProgressCache } from "~/lib/watch-progress";

/** A stand-in router whose calls tests can inspect. */
export const router = {
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => router,
}));

// Plays' arrivals and games' clocks are kept in memory, and what the viewer
// chose in localStorage; reset them between tests. Node tests have no window.
afterEach(() => {
  resetPlayArrivals();
  resetGameClocks();
  if (typeof window === "undefined") return;
  window.localStorage.clear();
  resetWatchProgressCache();
  resetBroadcastDelaysCache();
  resetCaughtUpCache();
  resetShowAllCache();
  resetFavoritesCache();
});
