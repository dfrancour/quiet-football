"use client";

import { type ReactNode } from "react";
import { CaughtUp } from "~/components/common/CaughtUp";
import { SiteMark } from "~/components/layout/SiteMark";
import { standingsPath } from "~/lib/routes";

interface SiteHeaderProps {
  /** The last week the viewer is caught up through; 0 for none. */
  through: number;
  /** As far as catching up goes. */
  settledThrough: number;
  /** The week the league is on, marked in the season strip. */
  currentWeek: number;
  totalWeeks: number;
  onCatchUp: (week: number) => void;
  /** Shown after the site's name, e.g. a team. */
  children?: ReactNode;
}

/**
 * The bar every page shares: the site's name (linking home), the page's
 * subject, and where the viewer is in the season at the right.
 */
export function SiteHeader({
  through,
  settledThrough,
  currentWeek,
  totalWeeks,
  onCatchUp,
  children,
}: SiteHeaderProps) {
  return (
    // Fixed height, so the bar matches with or without a team in it.
    <header className="flex min-h-8 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <SiteMark href={standingsPath()} />
        {children && (
          <>
            <span className="text-ink-faint shrink-0" aria-hidden>
              /
            </span>
            {children}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <CaughtUp
          through={through}
          settledThrough={settledThrough}
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
          onCatchUp={onCatchUp}
        />
      </div>
    </header>
  );
}
