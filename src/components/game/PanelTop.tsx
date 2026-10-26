import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactNode } from "react";
import { control } from "~/components/common/control";
import { RecapLink } from "~/components/recap/RecapLink";
import { type Recap } from "~/lib/recaps";
import { weekLabel } from "~/lib/schedule";
import { type TeamGame } from "~/lib/team-view";
import { cn } from "~/lib/utils";

/**
 * With the result hidden, the label is the way back to the newest play; the
 * hover state is the only hint. `clock` is the game's own, for when the score
 * row stands at an earlier play.
 */
export function LiveLabel({
  game,
  clock,
  onFollow,
}: {
  game: TeamGame;
  clock: string | null;
  onFollow?: () => void;
}) {
  const label = (
    <>
      <span className="bg-live animate-pulse-dot size-2 shrink-0 rounded-full" />
      <span className="label-eyebrow text-live">
        {weekLabel(game)} · Live
        {clock && <span className="tabular-nums"> · {clock}</span>}
      </span>
    </>
  );
  const className = "text-live flex items-center gap-2 whitespace-nowrap";
  if (!onFollow) return <span className={className}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onFollow}
      className={cn(className, "-m-2 rounded-md p-2 hover:brightness-125")}
      aria-label={`${weekLabel(game)}, live: watch from the newest play`}
      title="Watch live"
    >
      {label}
    </button>
  );
}

/**
 * The game is over. With the result hidden, the label is the way to the end;
 * as the live label, the hover state is the only hint.
 */
export function FinalLabel({
  game,
  onFinish,
}: {
  game: TeamGame;
  onFinish?: () => void;
}) {
  const label = (
    <span className="label-eyebrow text-inherit">
      {weekLabel(game)} · Final
    </span>
  );
  if (!onFinish) return label;
  return (
    <button
      type="button"
      onClick={onFinish}
      className={cn(control({ shape: "glyph" }), "whitespace-nowrap")}
      aria-label={`${weekLabel(game)}, final: see the game to the end`}
      title="See to the end"
    >
      {label}
    </button>
  );
}

export interface ExpandControl {
  expanded: boolean;
  onToggleExpanded?: () => void;
}

export function Eyebrow({
  children,
  expanded,
  onToggleExpanded,
  recap = null,
  flush = false,
}: {
  children: ReactNode;
  /** A finished game's recap, once the dataset has one. */
  recap?: Recap | null;
  /** Spaced by its parent, not its own margin. */
  flush?: boolean;
} & ExpandControl) {
  const Icon = expanded ? Minimize2 : Maximize2;
  const label = expanded ? "Exit full screen" : "Full screen";
  return (
    <div className={cn("flex items-center gap-3", !flush && "mb-4")}>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        {children}
      </div>
      {recap && <RecapLink recap={recap} />}
      {onToggleExpanded && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className={control({ shape: "glyph" })}
          aria-label={label}
          aria-pressed={expanded}
          title={expanded ? `${label} (Esc)` : label}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
