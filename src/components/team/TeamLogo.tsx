import Image from "next/image";
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

interface TeamLogoProps {
  team: Team;
  size?: keyof typeof SIZES;
  /** Set where no team name sits beside the mark; otherwise decorative. */
  labelled?: boolean;
  className?: string;
}

/**
 * A team's mark, straight from ESPN's CDN. Not a spoiler, so it ignores the
 * switch. A null logo renders an empty box of the same size.
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
    <Image
      src={team.logo}
      alt={labelled ? team.displayName : ""}
      width={px}
      height={px}
      unoptimized
      className={cn(box, HALO, "shrink-0 object-contain", className)}
    />
  );
}
