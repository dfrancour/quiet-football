import { Redacted } from "~/components/common/Redacted";
import { FootballIcon } from "~/components/score/Football";
import { TeamLogo } from "~/components/team/TeamLogo";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

interface ScoreLineProps {
  team: Team;
  /** Pre-formatted by the caller; null covers it. */
  display: string | null;
  /** Renders the followed team with emphasis. */
  emphasis?: boolean;
  /** Must stay false while scores are hidden. */
  leading?: boolean;
  /** Marks the side with the ball. Leave unset while spoilers are hidden. */
  hasBall?: boolean;
  /** Timeouts left this half, shown as pips. Leave unset to show none. */
  timeouts?: number | null;
  /**
   * A record, e.g. "3-1": after the game, going in, or as far as caught up
   * (`recordsShown`). Leave unset while spoilers are hidden.
   */
  record?: string | null;
  /**
   * Whether this side won. Any boolean reserves the caret's slot; true draws
   * it. Leave unset while spoilers are hidden, and for a tie.
   */
  won?: boolean | null;
  /** Lays the line out right to left, for the home side of a shared row. */
  mirrored?: boolean;
  /** Makes a covered figure the way to uncover it. */
  onReveal?: () => void;
  /**
   * A scorebug's side: mark, abbreviation and points as one block, the
   * timeouts under the abbreviation and no record.
   */
  compact?: boolean;
  className?: string;
}

const TIMEOUTS_PER_HALF = 3;

function TimeoutPips({ remaining }: { remaining: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${remaining} timeout${remaining === 1 ? "" : "s"} left`}
    >
      {Array.from({ length: TIMEOUTS_PER_HALF }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 w-2.5 rounded-full",
            index < remaining ? "bg-gold" : "bg-edge",
          )}
        />
      ))}
    </span>
  );
}

/**
 * One side of a scoreboard: mark, abbreviation and points. `mirrored` puts
 * the points on the inside edge: "SF 29 · 29 SEA".
 */
export function ScoreLine({
  team,
  display,
  emphasis = false,
  leading = false,
  hasBall = false,
  timeouts = null,
  record = null,
  won = null,
  mirrored = false,
  onReveal,
  compact = false,
  className,
}: ScoreLineProps) {
  const pips = timeouts !== null && <TimeoutPips remaining={timeouts} />;
  const figure = display ?? (
    <Redacted
      onReveal={onReveal}
      revealLabel={`Reveal score, ${team.abbreviation}`}
    />
  );
  const caret = won !== null && (
    // Points inward at the winner's figure from the middle of the row.
    <span className="flex h-5 w-4 shrink-0 items-center justify-center">
      {won && (
        <>
          <svg
            viewBox="0 0 8 10"
            className={cn("text-ink h-2.5 w-2", mirrored && "rotate-180")}
            aria-hidden
          >
            <path d="M0 5 8 0v10z" fill="currentColor" />
          </svg>
          <span className="sr-only">Winner</span>
        </>
      )}
    </span>
  );

  if (compact) {
    // The ball sits with the timeouts under the name, inside the block.
    return (
      <div
        className={cn(
          "flex items-center",
          mirrored && "flex-row-reverse",
          className,
        )}
      >
        <span
          className={cn(
            "bg-surface-raised flex items-center gap-2 rounded-lg py-1 pr-2.5 pl-1",
            mirrored && "flex-row-reverse pr-1 pl-2.5",
          )}
        >
          <TeamLogo team={team} size="md" />
          <span
            className={cn(
              "flex flex-col gap-1",
              mirrored ? "items-end" : "items-start",
            )}
          >
            <span
              className={cn(
                "font-mono text-base leading-none tracking-wide",
                emphasis ? "text-ink font-semibold" : "text-ink-muted",
              )}
              title={team.displayName}
            >
              {team.abbreviation}
            </span>
            {/* The ball's place is kept whoever has it, so a change of
                possession only shows or hides it. */}
            {(pips || hasBall) && (
              <span
                className={cn(
                  "flex h-2.5 items-center gap-1.5",
                  mirrored && "flex-row-reverse",
                )}
              >
                {pips}
                <FootballIcon
                  className={cn(
                    "text-ink-muted h-2.5 w-4 shrink-0",
                    !hasBall && "invisible",
                  )}
                />
              </span>
            )}
          </span>
          <span
            className={cn(
              "stat-figure min-w-[2ch] text-2xl leading-none",
              mirrored ? "text-left" : "text-right",
              leading ? "text-ink" : "text-ink-muted",
            )}
          >
            {figure}
          </span>
        </span>
        {caret}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 sm:gap-3",
        mirrored && "flex-row-reverse",
        className,
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-2",
          mirrored && "flex-row-reverse",
        )}
      >
        <TeamLogo team={team} size="lg" className="max-sm:size-8" />
        <span className={cn("flex flex-col gap-1", mirrored && "items-end")}>
          <span
            className={cn(
              "flex items-center gap-1.5",
              mirrored && "flex-row-reverse",
            )}
          >
            <span
              className={cn(
                "font-mono text-xl tracking-wide sm:text-2xl",
                emphasis ? "text-ink font-semibold" : "text-ink-muted",
              )}
              title={team.displayName}
            >
              {team.abbreviation}
            </span>
            {hasBall && (
              <FootballIcon className="text-ink-muted h-3 w-5 shrink-0" />
            )}
          </span>
          {(record !== null || timeouts !== null) && (
            <span
              className={cn(
                "flex items-center gap-2",
                mirrored && "flex-row-reverse",
              )}
            >
              {record !== null && (
                <span className="text-ink-faint font-mono text-xs">
                  <span className="sr-only">Record </span>
                  {record}
                </span>
              )}
              {pips}
            </span>
          )}
        </span>
      </span>
      <span className={cn("flex items-center", mirrored && "flex-row-reverse")}>
        <span
          className={cn(
            "stat-figure text-3xl sm:text-4xl",
            leading ? "text-ink" : "text-ink-muted",
          )}
        >
          {figure}
        </span>
        {caret}
      </span>
    </div>
  );
}
