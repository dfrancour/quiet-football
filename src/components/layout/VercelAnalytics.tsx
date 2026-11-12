"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { asksNotToTrack } from "~/lib/tracking";

/**
 * Vercel's anonymous page analytics and speed insights. A browser that asks
 * not to be tracked (Global Privacy Control or Do Not Track) sends nothing.
 */
export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => (asksNotToTrack() ? null : event)} />
      <SpeedInsights beforeSend={(data) => (asksNotToTrack() ? null : data)} />
    </>
  );
}
