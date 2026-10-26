"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function getFullScreen(): boolean {
  return document.fullscreenElement != null;
}

function getServerFullScreen(): boolean {
  return false;
}

function exitFullScreen() {
  if (document.fullscreenElement != null)
    document.exitFullscreen().catch(() => {});
}

/**
 * The game panel's full screen. Where the browser can, the whole page goes
 * full screen, hiding the browser's bars and the system's; where it cannot
 * (an iPhone) or refuses, only the page's own header and schedule are
 * hidden. The browser can leave full screen without the page (Escape, the
 * back gesture), so being full screen is read from it, not kept here.
 * Leaving the page leaves full screen.
 */
export function useFullScreen(): [expanded: boolean, toggle: () => void] {
  const browser = useSyncExternalStore(
    subscribe,
    getFullScreen,
    getServerFullScreen,
  );
  const [inPage, setInPage] = useState(false);
  const expanded = browser || inPage;

  const toggle = useCallback(() => {
    if (document.fullscreenElement != null) {
      exitFullScreen();
      return;
    }
    if (inPage) {
      setInPage(false);
      return;
    }
    if (!document.fullscreenEnabled) {
      setInPage(true);
      return;
    }
    document.documentElement.requestFullscreen().catch(() => setInPage(true));
  }, [inPage]);

  useEffect(() => {
    if (!inPage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInPage(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inPage]);

  useEffect(() => exitFullScreen, []);

  return [expanded, toggle];
}

function noSubscription(): () => void {
  return () => undefined;
}

/** Whether the browser can put the page itself full screen (an iPhone cannot). */
export function useFullScreenEnabled(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled,
    () => false,
  );
}
