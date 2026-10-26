"use client";

import { StepperBar } from "~/components/common/StepperBar";
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
  const timeZone = useTimeZone();
  const away = useScrollAway();

  // The schedule's rows in order, a bye a row like any other.
  const weeks = [
    ...schedule.games.map((game) => game.week),
    ...schedule.byeWeeks,
  ].sort((a, b) => a - b);
  const index = weeks.indexOf(selectedGame?.week ?? selectedBye ?? -1);
  const before = index === -1 ? undefined : weeks[index - 1];
  const after = index === -1 ? undefined : weeks[index + 1];
  const go = (week: number | undefined) => {
    if (week === undefined) return null;
    return () => {
      const game = schedule.games.find((entry) => entry.week === week);
      if (game) onSelect(game.gameId);
      else onSelectBye(week);
    };
  };

  return (
    <div
      className={cn(
        "bg-surface fixed inset-x-0 bottom-0 z-20 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transition-transform duration-200 focus-within:translate-y-0 motion-reduce:transition-none",
        // Focus brings it back, so a keyboard never lands on it unseen.
        away && "translate-y-full",
      )}
    >
      <div className="mx-4">
        <StepperBar
          onBack={go(before)}
          onNext={go(after)}
          sheetLabel={`${schedule.season} schedule`}
          sheet={(close) => (
            <ScheduleSelector
              schedule={schedule}
              selectedGameId={selectedGame?.gameId ?? null}
              selectedBye={selectedBye}
              onSelect={(gameId) => {
                onSelect(gameId);
                close();
              }}
              onSelectBye={(week) => {
                onSelectBye(week);
                close();
              }}
              isShown={isShown}
              now={now}
            />
          )}
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
        </StepperBar>
      </div>
    </div>
  );
}
