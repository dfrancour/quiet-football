"use client";

import { useEffect, useState } from "react";

/** How far the page must move one way before the bar follows. */
const STEP_PX = 8;
/** Near the top of the page the bar always shows. */
const TOP_PX = 48;

/**
 * Whether a bar along the bottom of the page should be out of the way: once
 * the viewer scrolls down, until they scroll back up, near the top, or reach
 * the end, where there is nothing more to read under it.
 */
export function useScrollAway(): boolean {
  const [away, setAway] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atEnd =
        y + window.innerHeight >=
        document.documentElement.scrollHeight - STEP_PX;
      if (y < TOP_PX || atEnd) {
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
