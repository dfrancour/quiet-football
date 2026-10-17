"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Sheet } from "~/components/common/Sheet";
import { ScheduleSelector } from "~/components/schedule/ScheduleSelector";
import { TeamLogo } from "~/components/team/TeamLogo";
import { useTimeZone } from "~/hooks/useTimeZone";
import { formatShortDate } from "~/lib/dates";
import { matchupLabel, weekLabel } from "~/lib/schedule";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";

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
 * The team page's schedule as a menu, for a phone: a bar naming the selected
 * game opens the season as a sheet from the bottom, and picking a game closes
 * it. The game and the schedule are never on screen together.
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

  return (
    <>
      <button
        ref={barRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="border-edge hover:bg-surface-raised/60 flex w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors"
      >
        <CalendarDays className="text-ink-faint size-4 shrink-0" aria-hidden />
        {selectedGame ? (
          <>
            <TeamLogo team={selectedGame.opponent} />
            <span className="text-ink min-w-0 flex-1 truncate text-sm font-semibold">
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
          <span className="text-ink min-w-0 flex-1 truncate text-sm font-semibold">
            Week {selectedBye}
            <span className="text-ink-muted font-normal">{" · Bye"}</span>
          </span>
        ) : (
          <span className="text-ink-muted flex-1 text-sm">Schedule</span>
        )}
        <ChevronDown className="text-ink-faint size-4 shrink-0" aria-hidden />
      </button>

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
    </>
  );
}
