"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Sheet } from "~/components/common/Sheet";
import { ScheduleSelector } from "~/components/schedule/ScheduleSelector";
import { TeamLogo } from "~/components/team/TeamLogo";
import { useScrollAway } from "~/hooks/useScrollAway";
import { useTimeZone } from "~/hooks/useTimeZone";
import { formatShortDate } from "~/lib/dates";
import { matchupLabel, weekLabel } from "~/lib/schedule";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";
import { cn } from "~/lib/utils";

interface ScheduleSwitcherProps {
  schedule: TeamSchedule;
  selectedGame: TeamGame | null;
  /** The bye week selected, if one is. */
  selectedBye: number | null;
  onSelect: (gameId: string) => void;
  onSelectBye: (week: number) => void;
  isShown: (game: TeamGame) => boolean;
  now: number | null;
}

/**
 * The team page's schedule for a phone, along the bottom within reach of a
 * thumb: the week before and after either side of the selected game's name,
 * which opens the season as a sheet; picking a game closes it. It slides away
 * as the page scrolls down and back as it scrolls up. The game and the
 * schedule are never on screen together.
 */
export function ScheduleSwitcher({
  schedule,
  selectedGame,
  selectedBye,
  onSelect,
  onSelectBye,
  isShown,
  now,
}: ScheduleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLButtonElement>(null);
  const timeZone = useTimeZone();
  const away = useScrollAway();
  // Closed, focus goes back to the bar it came from.
  const close = useCallback(() => {
    setOpen(false);
    barRef.current?.focus();
  }, []);

  const pick = (gameId: string) => {
    onSelect(gameId);
    close();
  };
  const pickBye = (week: number) => {
    onSelectBye(week);
    close();
  };

  // The schedule's rows in order, a bye a row like any other.
  const weeks = [
    ...schedule.games.map((game) => game.week),
    ...schedule.byeWeeks,
  ].sort((a, b) => a - b);
  const index = weeks.indexOf(selectedGame?.week ?? selectedBye ?? -1);
  const before = index === -1 ? undefined : weeks[index - 1];
  const after = index === -1 ? undefined : weeks[index + 1];
  const go = (week: number) => {
    const game = schedule.games.find((entry) => entry.week === week);
    if (game) onSelect(game.gameId);
    else onSelectBye(week);
  };
  const step = (to: number | undefined, label: string, Icon: LucideIcon) => (
    <button
      type="button"
      aria-label={label}
      disabled={to === undefined}
      onClick={() => to !== undefined && go(to)}
      className="text-ink-muted hover:text-ink disabled:text-ink-faint/40 flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-md transition-colors disabled:cursor-default"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );

  return (
    <div
      className={cn(
        "bg-surface fixed inset-x-0 bottom-0 z-20 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transition-transform duration-200 focus-within:translate-y-0 motion-reduce:transition-none",
        // Focus brings it back, so a keyboard never lands on it unseen.
        away && !open && "translate-y-full",
      )}
    >
      <div className="border-edge mx-4 flex items-center border-t py-1">
        {step(before, "Previous week", ChevronLeft)}
        <button
          ref={barRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="hover:bg-surface-raised/60 flex h-11 min-w-0 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors"
        >
          {selectedGame ? (
            <>
              <TeamLogo team={selectedGame.opponent} />
              <span className="text-ink truncate font-semibold">
                {weekLabel(selectedGame)}
                <span className="text-ink-muted font-normal">
                  {" · "}
                  {matchupLabel(selectedGame)}
                  {" · "}
                  {formatShortDate(selectedGame.kickoff, timeZone) ?? "TBD"}
                </span>
              </span>
            </>
          ) : selectedBye !== null ? (
            <span className="text-ink truncate font-semibold">
              Week {selectedBye}
              <span className="text-ink-muted font-normal">{" · Bye"}</span>
            </span>
          ) : (
            <span className="text-ink-muted">Schedule</span>
          )}
          <ChevronUp className="text-ink-faint size-4 shrink-0" aria-hidden />
        </button>
        {step(after, "Next week", ChevronRight)}
      </div>

      {open && (
        <Sheet label={`${schedule.season} schedule`} onClose={close}>
          <ScheduleSelector
            schedule={schedule}
            selectedGameId={selectedGame?.gameId ?? null}
            selectedBye={selectedBye}
            onSelect={pick}
            onSelectBye={pickBye}
            isShown={isShown}
            now={now}
          />
        </Sheet>
      )}
    </div>
  );
}
