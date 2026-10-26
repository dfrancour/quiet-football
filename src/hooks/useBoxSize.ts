"use client";

import { useEffect, useState, type RefObject } from "react";

export interface BoxSize {
  width: number;
  height: number;
}

/**
 * The content box of `ref`'s element, kept current as it resizes while
 * `active`. Null until first measured, and where nothing can measure it.
 */
export function useBoxSize(
  ref: RefObject<HTMLElement | null>,
  active = true,
): BoxSize | null {
  const [size, setSize] = useState<BoxSize | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!active || !element || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((before) =>
        before?.width === width && before.height === height
          ? before
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, active]);
  return size;
}
