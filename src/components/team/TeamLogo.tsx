"use client";

import Image from "next/image";
import { useState } from "react";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

/**
 * ESPN has a true dark mark for only ten teams; a navy or black one sinks
 * into the page. A hairline light halo lifts it and is invisible on light
 * marks, so every team gets it.
 */
const HALO = "drop-shadow-[0_0_1px_rgba(255,255,255,0.55)]";

const SIZES = {
  sm: { px: 20, box: "size-5" },
  md: { px: 28, box: "size-7" },
  lg: { px: 44, box: "size-11" },
} as const;

/**
 * The size asked of ESPN's CDN. No mark is drawn larger than 44px, so one
 * file per team is crisp on a 2× screen in every box and is shared across
 * pages, where the original is 500px (Green Bay's 4096) and cached for
 * minutes.
 */
const LOGO_PX = 96;

const CDN = "https://a.espncdn.com";

/** The mark at the drawn size, through ESPN's own resizer; another host as is. */
export function logoAt(href: string, px: number): string {
  if (!href.startsWith(`${CDN}/`)) return href;
  return `${CDN}/combiner/i?img=${href.slice(CDN.length)}&h=${px}&w=${px}`;
}

interface TeamLogoProps {
  team: Team;
  size?: keyof typeof SIZES;
  /** Set where no team name sits beside the mark; otherwise decorative. */
  labelled?: boolean;
  className?: string;
}

/**
 * A team's mark, from ESPN's CDN at the size it is drawn. Not a spoiler, so
 * it ignores the switch. It fades in once it has arrived rather than popping
 * into its box; a null logo renders an empty box of the same size.
 */
export function TeamLogo({
  team,
  size = "sm",
  labelled = false,
  className,
}: TeamLogoProps) {
  const { px, box } = SIZES[size];

  if (!team.logo) {
    return <span aria-hidden className={cn(box, "shrink-0", className)} />;
  }

  return (
    <Mark
      key={team.logo}
      src={logoAt(team.logo, LOGO_PX)}
      alt={labelled ? team.displayName : ""}
      px={px}
      className={cn(box, HALO, "shrink-0 object-contain", className)}
    />
  );
}

interface MarkProps {
  src: string;
  alt: string;
  px: number;
  className: string;
}

/** Keyed by its source, so a new mark starts unseen and fades in like the first. */
function Mark({ src, alt, px, className }: MarkProps) {
  const [arrived, setArrived] = useState(false);
  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      unoptimized
      loading="eager"
      onLoad={() => setArrived(true)}
      className={cn(
        className,
        "transition-opacity duration-150 motion-reduce:transition-none",
        arrived ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
