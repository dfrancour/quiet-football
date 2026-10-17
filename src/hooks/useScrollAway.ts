"use client";

import { useEffect, useState } from "react";

/** How far the page must move one way before the bar follows. */
const STEP_PX = 8;
/** Near the top of the page the bar always shows. */
const TOP_PX = 48;

/**
 * Whether a bar along the bottom of the page should be out of the way: once
 * the viewer scrolls down, until they scroll back up or near the top. The
 * page leaves room for the bar at its end, so reaching it hides nothing.
 */
export function useScrollAway(): boolean {
  const [away, setAway] = useState(false);

  useEffect(() => {
    // A bounce past either end of the page is not a scroll either way.
    const position = () =>
      Math.min(
        Math.max(window.scrollY, 0),
        document.documentElement.scrollHeight - window.innerHeight,
      );
    let last = position();
    const onScroll = () => {
      const y = position();
      if (y < TOP_PX) {
        setAway(false);
        last = y;
        return;
      }
      if (Math.abs(y - last) < STEP_PX) return;
      setAway(y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return away;
}
