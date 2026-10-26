"use client";

import { useMediaQuery } from "~/hooks/useMediaQuery";

/**
 * A phone on its side: wide but short. A laptop is landscape too, but tall
 * enough for the usual layout.
 */
export const SIDEWAYS = "(orientation: landscape) and (max-height: 30rem)";

/** Whether the screen is a phone on its side (`SIDEWAYS`). */
export function useSideways(): boolean {
  return useMediaQuery(SIDEWAYS);
}
