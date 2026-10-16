"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useDismiss } from "~/hooks/useDismiss";
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
  onCatchUp: (week: number) => void;
}

/** Each week's cover lifts this long after the one before. */
const SWEEP_STEP_MS = 18;

function label(totalWeeks: number, week: number): string {
  return week > 0 ? `Through ${weekName(totalWeeks, week)}` : "Spoilers hidden";
}

/**
 * Where the viewer is in the season: everything through that week is shown.
 * It opens the season as a strip: weeks caught up through read plainly,
 * settled weeks past them are hatched like any hidden result, and weeks not
 * yet played are faint. Tapping a settled week uncovers (or covers) the strip
 * up to it.
 */
export function CaughtUp({
  through,
  settledThrough,
  currentWeek,
  totalWeeks,
  onCatchUp,
}: CaughtUpProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  // The week just picked, shown until the page catches up with it.
  const [pending, setPending] = useState<{ week: number; from: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const committed =
    pending !== null && pending.from === through ? pending.week : through;
  const reachable = Math.max(committed, settledThrough);
  const shown = preview ?? committed;
  const Icon = committed > 0 ? Eye : EyeOff;

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const choose = (week: number) => {
    setPreview(null);
    if (week === committed) return;
    setPending({ week, from: through });
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
    const next = Math.min(reachable, Math.max(1, at + step));
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
    const settled = week <= reachable;
    const uncovered = week <= shown;
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
        aria-pressed={week === committed}
        aria-label={label(totalWeeks, week)}
        title={week === currentWeek ? "This week" : undefined}
        onClick={() => choose(week)}
        onPointerEnter={() => settled && setPreview(week)}
        onFocus={() => setPreview(week)}
        className={cn(
          "relative h-7 min-w-0 overflow-hidden font-mono text-[0.6875rem] tabular-nums transition-colors first:rounded-l-sm last:rounded-r-sm",
          !settled
            ? "bg-surface-sunken/50 text-ink-faint/60 cursor-default"
            : uncovered
              ? "bg-accent-dim text-ink cursor-pointer"
              : "bg-surface-sunken text-ink-muted cursor-pointer",
          week === committed && "font-semibold",
        )}
      >
        {settled && (
          <span
            aria-hidden
            style={sweep}
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

  // One way of talking: caught up through a week, and steps from there.
  const status =
    preview === null || preview === committed
      ? committed > 0
        ? `Caught up through ${weekName(totalWeeks, committed)}`
        : "Spoilers hidden"
      : preview === 0
        ? "Hide all spoilers"
        : preview > committed
          ? `Catch up through ${weekName(totalWeeks, preview)}`
          : `Go back to ${weekName(totalWeeks, preview)}`;

  return (
    <div ref={rootRef} className="relative flex">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "-m-1 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md p-1 text-xs whitespace-nowrap transition-colors",
          committed > 0
            ? "text-ink-muted"
            : "text-ink-faint hover:text-ink-muted",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {label(totalWeeks, committed)}
      </button>

      {open && (
        <div
          role="group"
          aria-label="Caught up through"
          onPointerLeave={() => setPreview(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPreview(null);
            }
          }}
          className="border-edge bg-surface-raised absolute top-full right-0 z-20 mt-2 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2 rounded-md border p-3 shadow-lg"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-eyebrow">Spoilers</span>
            <span className="text-ink-muted truncate text-xs" role="status">
              {status}
            </span>
          </div>

          <div className="flex flex-col gap-px" onKeyDown={onStripKeyDown}>
            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))`,
              }}
            >
              {regular.map(cell)}
            </div>
            {rounds.length > 0 && (
              <div className="grid grid-cols-4 gap-px">{rounds.map(cell)}</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              disabled={committed === 0}
              onClick={() => choose(0)}
              onPointerEnter={() => committed > 0 && setPreview(0)}
              onPointerLeave={() => setPreview(null)}
              className="text-ink-faint hover:text-ink-muted disabled:text-ink-faint/50 cursor-pointer transition-colors disabled:cursor-default"
            >
              Hide all
            </button>
            {committed < settledThrough && (
              <button
                type="button"
                onClick={() => choose(settledThrough)}
                onPointerEnter={() => setPreview(settledThrough)}
                onPointerLeave={() => setPreview(null)}
                className="text-ink-muted hover:text-ink inline-flex cursor-pointer items-center gap-1 transition-colors"
              >
                Catch up through {weekName(totalWeeks, settledThrough)}
                <ArrowRight className="size-3" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
