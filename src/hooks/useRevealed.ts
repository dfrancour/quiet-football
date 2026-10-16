"use client";

import { useEffect, useState, type RefObject } from "react";

/** How long a page waits for its marks before showing without them. */
const HOLD_MS = 400;

/** Resolves once the image is ready to paint, however it ends. */
function arrived(image: HTMLImageElement): Promise<unknown> {
  if (typeof image.decode === "function")
    return image.decode().catch(() => null);
  return new Promise((resolve) => {
    if (image.complete) return resolve(null);
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  });
}

/**
 * Whether the element's images have arrived, so a page is shown whole rather
 * than drawn and then filled in mark by mark. It gives up after a moment: a
 * slow logo must not hold the season, and fades in on its own when it lands.
 */
export function useRevealed(ref: RefObject<HTMLElement | null>): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let waiting = true;
    const reveal = () => {
      if (!waiting) return;
      waiting = false;
      setRevealed(true);
    };
    const timer = setTimeout(reveal, HOLD_MS);
    const images = Array.from(root.querySelectorAll("img"));
    void Promise.all(images.map(arrived)).then(reveal);
    return () => {
      waiting = false;
      clearTimeout(timer);
    };
  }, [ref]);
  return revealed;
}

/** The fade a revealed page comes in with; unseen until then. */
export function revealClass(revealed: boolean): string {
  return revealed
    ? "opacity-100 transition-opacity duration-300 ease-out motion-reduce:transition-none"
    : "opacity-0";
}
