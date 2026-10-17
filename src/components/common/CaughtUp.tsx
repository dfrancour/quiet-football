"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Sheet } from "~/components/common/Sheet";
import { useDismiss } from "~/hooks/useDismiss";
import { useIntroduced } from "~/hooks/useIntroduced";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { type PartialWeek } from "~/hooks/useSpoilers";
import { markIntroduced } from "~/lib/first-run";
import {
  playoffRound,
  ROUND_ABBREVIATIONS,
  seasonWeeks,
  weekName,
} from "~/lib/season-calendar";
import { cn } from "~/lib/utils";

interface CaughtUpProps {
  /** The last week the viewer is caught up through; 0 for none. */
  through: number;
  /** As far as catching up goes: the last week every game is settled through. */
  settledThrough: number;
  /** The week the league is on, marked as the week chooser marks it. */
  currentWeek: number;
  totalWeeks: number;
  /**
   * The week in progress, offered as half a week once a game in it is over,
   * and whether its finished games are seen. Null while none is.
   */
  partial: PartialWeek | null;
  onCatchUp: (week: number) => void;
}

/** Each week's cover lifts this long after the one before. */
const SWEEP_STEP_MS = 18;

/** The upper-left half of a cell: a week in progress is filled this far. */
const HALF: CSSProperties = { clipPath: "polygon(0 0, 100% 0, 0 100%)" };

function label(totalWeeks: number, week: number, partial = false): string {
  if (week === 0) return "Spoilers hidden";
  const name = weekName(totalWeeks, week);
  return partial ? `${name} so far` : `Through ${name}`;
}

/** Tailwind's `sm`: from here the strip is a popover under the control. */
const WIDE = "(min-width: 40rem)";

/**
 * Where the viewer is in the season: everything through that week is shown.
 * It opens the season as a strip: weeks caught up through read plainly,
 * settled weeks past them are hatched like any hidden result, and weeks not
 * yet played are faint. Tapping a settled week uncovers (or covers) the strip
 * up to it. A week in progress is half a cell, split corner to corner, once
 * a game in it is over: tapping it uncovers everything settled, that week's
 * finished games included, and the half fills; as more of its games end it
 * is hatched again until tapped. On a phone the strip comes up as a sheet,
 * its weeks in rows of nine so each is a fingertip wide, and closes on a
 * pick.
 *
 * A first visit opens the strip by itself, asking for the last week seen,
 * since a page of covered results says nothing about why; closing it or
 * picking a week ends that for good (`first-run.ts`). A viewer already
 * caught up through a week has found the control, and is not shown it.
 */
export function CaughtUp({
  through,
  settledThrough,
  currentWeek,
  totalWeeks,
  partial,
  onCatchUp,
}: CaughtUpProps) {
  const [opened, setOpened] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  // The week just picked, shown until the page catches up with it.
  const [pending, setPending] = useState<{ week: number; from: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const wide = useMediaQuery(WIDE, true);

  const committed =
    pending !== null && pending.from === through ? pending.week : through;
  const reachable = Math.max(committed, settledThrough);
  const shown = preview ?? committed;
  // Caught up into the week in progress: every settled week and its finished
  // games. The furthest the strip goes.
  const intoPartial =
    partial !== null && partial.uncovered && committed >= settledThrough;
  const furthest = partial?.week ?? reachable;
  const Icon = committed > 0 ? Eye : EyeOff;

  // Open by itself on a first visit, until closed or a week is picked.
  const introducing = !useIntroduced() && through === 0;
  const open = opened || introducing;

  const close = useCallback(() => {
    setOpened(false);
    markIntroduced();
  }, []);
  // The popover closes on a press outside; the sheet sees to itself.
  useDismiss(rootRef, open && wide, close);
  const closeSheet = useCallback(() => {
    close();
    controlRef.current?.focus();
  }, [close]);

  const choose = (week: number) => {
    setPreview(null);
    markIntroduced();
    if (!wide) closeSheet();
    if (week === committed || (week === partial?.week && intoPartial)) return;
    // The week in progress catches up through every settled week first.
    setPending({
      week: week === partial?.week ? Math.max(through, settledThrough) : week,
      from: through,
    });
    onCatchUp(week);
  };

  /** Arrow keys walk the settled weeks; focusing one previews it. */
  const onStripKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    const at = Number(
      (event.target as HTMLElement).dataset.week ?? String(committed),
    );
    const next = Math.min(furthest, Math.max(1, at + step));
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-week="${next}"]`)
      ?.focus();
    event.preventDefault();
  };

  const regular = Array.from({ length: totalWeeks }, (_, index) => index + 1);
  // Rounds join once the regular season is settled: before, they say nothing.
  const rounds =
    reachable >= totalWeeks
      ? Array.from(
          { length: seasonWeeks(totalWeeks) - totalWeeks },
          (_, index) => totalWeeks + index + 1,
        )
      : [];

  const cell = (week: number) => {
    const round = playoffRound(totalWeeks, week);
    const half = week === partial?.week;
    const settled = week <= reachable || half;
    const uncovered = half
      ? (partial.uncovered && shown >= settledThrough) || preview === week
      : week <= shown;
    // Picked, the covers sweep away from the old place toward the new one.
    const sweep: CSSProperties | undefined =
      preview === null && pending !== null && pending.from === through
        ? {
            transitionDelay: `${Math.abs(week - pending.from) * SWEEP_STEP_MS}ms`,
          }
        : undefined;
    return (
      <button
        key={week}
        type="button"
        data-week={week}
        disabled={!settled}
        aria-pressed={half ? intoPartial : week === committed}
        aria-label={label(totalWeeks, week, half)}
        title={week === currentWeek ? "This week" : undefined}
        onClick={() => choose(week)}
        onPointerEnter={() => settled && setPreview(week)}
        onFocus={() => setPreview(week)}
        className={cn(
          "relative min-w-0 overflow-hidden font-mono text-[0.6875rem] tabular-nums transition-colors first:rounded-l-sm last:rounded-r-sm",
          wide ? "h-9" : "h-11 text-xs",
          !settled || half
            ? "bg-surface-sunken/50"
            : uncovered
              ? "bg-accent-dim"
              : "bg-surface-sunken",
          !settled
            ? "text-ink-faint/60 cursor-default"
            : uncovered
              ? "text-ink cursor-pointer"
              : "text-ink-muted cursor-pointer",
          (half ? intoPartial : week === committed) && "font-semibold",
        )}
      >
        {/* A week in progress is filled to its diagonal, the rest unplayed. */}
        {half && (
          <span
            aria-hidden
            style={HALF}
            className={cn(
              "absolute inset-0 transition-colors",
              uncovered ? "bg-accent-dim" : "bg-surface-sunken",
            )}
          />
        )}
        {settled && (
          <span
            aria-hidden
            style={half ? { ...HALF, ...sweep } : sweep}
            className={cn(
              "hatched absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none",
              uncovered ? "opacity-0" : "opacity-100",
            )}
          />
        )}
        <span className="relative">
          {round ? ROUND_ABBREVIATIONS[round] : week}
        </span>
        {/* The week chooser's faint rule for this week. */}
        {week === currentWeek && (
          <span className="bg-ink-faint absolute bottom-0.5 left-1/2 h-px w-3 -translate-x-1/2 rounded-full" />
        )}
      </button>
    );
  };

  // One way of talking: caught up through a week, and steps from there. The
  // week in progress is "so far": its finished games, not the week.
  const name = (week: number) =>
    week === partial?.week
      ? `${weekName(totalWeeks, week)} so far`
      : weekName(totalWeeks, week);
  const status =
    preview === null ||
    preview === committed ||
    (preview === partial?.week && intoPartial)
      ? intoPartial
        ? `Caught up through ${name(partial.week)}`
        : committed > 0
          ? `Caught up through ${name(committed)}`
          : introducing
            ? "Pick the last week you've seen"
            : "Spoilers hidden"
      : preview === 0
        ? "Hide all spoilers"
        : preview > committed
          ? `Catch up through ${name(preview)}`
          : `Go back to ${name(preview)}`;

  // The shortcut's target: the week in progress once it has games to take,
  // else the last settled week.
  const ahead =
    partial !== null && !partial.uncovered
      ? partial.week
      : committed < settledThrough
        ? settledThrough
        : null;

  // With nothing caught up the control is the page's one way in, so it is
  // the brighter of its two states, not the fainter.
  const tone =
    committed > 0
      ? "text-ink-muted hover:text-ink"
      : "text-ink-muted hover:text-ink font-semibold";

  // The strip and its actions, the same in the popover and the sheet.
  const strip = (
    <div
      role="group"
      aria-label="Caught up through"
      onPointerLeave={() => setPreview(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPreview(null);
        }
      }}
      className={cn("flex flex-col", wide ? "gap-2" : "gap-3 px-3 pt-1")}
    >
      <div className="flex items-baseline justify-between gap-3">
        {wide && <span className="label-eyebrow">Spoilers</span>}
        <span className="text-ink-muted truncate text-xs" role="status">
          {status}
        </span>
      </div>

      <div className="flex flex-col gap-px" onKeyDown={onStripKeyDown}>
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${wide ? totalWeeks : 9}, minmax(0, 1fr))`,
          }}
        >
          {regular.map(cell)}
        </div>
        {rounds.length > 0 && (
          <div className="grid grid-cols-4 gap-px">{rounds.map(cell)}</div>
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-3",
          wide ? "text-xs" : "min-h-11 text-sm",
        )}
      >
        <button
          type="button"
          disabled={committed === 0}
          onClick={() => choose(0)}
          onPointerEnter={() => committed > 0 && setPreview(0)}
          onPointerLeave={() => setPreview(null)}
          className="text-ink-faint hover:text-ink-muted disabled:text-ink-faint/50 -my-2 cursor-pointer py-2 transition-colors disabled:cursor-default"
        >
          Hide all
        </button>
        {ahead !== null && (
          <button
            type="button"
            onClick={() => choose(ahead)}
            onPointerEnter={() => setPreview(ahead)}
            onPointerLeave={() => setPreview(null)}
            className="text-ink-muted hover:text-ink -my-2 inline-flex cursor-pointer items-center gap-1 py-2 transition-colors"
          >
            Catch up through {name(ahead)}
            <ArrowRight className="size-3" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex">
      <button
        ref={controlRef}
        type="button"
        aria-expanded={open}
        aria-haspopup={wide ? undefined : "dialog"}
        onClick={() => (open ? close() : setOpened(true))}
        className={cn(
          "hover:bg-surface-raised inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs whitespace-nowrap transition-colors",
          tone,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {intoPartial
          ? label(totalWeeks, partial.week, true)
          : label(totalWeeks, committed)}
      </button>

      {open &&
        (wide ? (
          <div className="border-edge bg-surface-raised absolute top-full right-0 z-20 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-md border p-3 shadow-lg">
            {strip}
          </div>
        ) : (
          <Sheet label="Spoilers" onClose={closeSheet}>
            {strip}
          </Sheet>
        ))}
    </div>
  );
}
