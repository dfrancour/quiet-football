"use client";

import { Info } from "lucide-react";
import { type ReactNode } from "react";
import { type PartialWeek } from "~/hooks/useSpoilers";
import { CaughtUp } from "~/components/common/CaughtUp";
import { control } from "~/components/common/control";
import Link from "next/link";
import { SiteMark } from "~/components/layout/SiteMark";
import { aboutPath, standingsPath } from "~/lib/routes";

/**
 * The way to `/about`: a circled i, drawn and sized like the spoiler control
 * beside it so the two read as one group of quiet controls.
 */
export function AboutLink() {
  return (
    <Link
      href={aboutPath()}
      aria-label="About"
      title="About"
      className={control({ shape: "box", size: 8 })}
    >
      <Info className="size-4" aria-hidden />
    </Link>
  );
}

interface SiteHeaderProps {
  /** The last week the viewer is caught up through; 0 for none. */
  through: number;
  /** Every result shown, whatever the viewer is caught up through. */
  showAll: boolean;
  onShowAll: (on: boolean) => void;
  /** As far as catching up goes. */
  settledThrough: number;
  /** The week the league is on, marked in the season strip. */
  currentWeek: number;
  totalWeeks: number;
  /** The week in progress, if the strip is to offer it. */
  partial: PartialWeek | null;
  onCatchUp: (week: number) => void;
  /** Whether the way to About is offered; only the league page does. */
  about?: boolean;
  /** Shown after the site's name, e.g. a team. */
  children?: ReactNode;
}

/**
 * The bar every page shares: the site's name (linking home), the page's
 * subject, and the controls at the right: where the viewer is in the season
 * and, on the league page, the way to About. On a phone a subject takes a
 * row of its own beneath, so the controls stay top right on every page.
 */
export function SiteHeader({
  through,
  showAll,
  onShowAll,
  settledThrough,
  currentWeek,
  totalWeeks,
  partial,
  onCatchUp,
  about = true,
  children,
}: SiteHeaderProps) {
  // A page with a subject is one step in from the league.
  const back = children !== undefined && children !== null;
  return (
    // Fixed height, so the bar matches with or without a team in it.
    <header className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-3">
      <SiteMark href={standingsPath()} back={back} />
      {children && (
        <>
          <span
            className="text-ink-faint hidden shrink-0 sm:inline"
            aria-hidden
          >
            /
          </span>
          <div className="order-3 flex min-w-0 basis-full items-center sm:order-2 sm:flex-1 sm:basis-auto">
            {children}
          </div>
        </>
      )}

      <div className="order-2 ml-auto flex items-center gap-1 sm:order-3">
        {about && <AboutLink />}
        <CaughtUp
          through={through}
          showAll={showAll}
          onShowAll={onShowAll}
          settledThrough={settledThrough}
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
          partial={partial}
          onCatchUp={onCatchUp}
        />
      </div>
    </header>
  );
}
