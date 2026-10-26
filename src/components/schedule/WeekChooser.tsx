"use client";

import { StepperBar } from "~/components/common/StepperBar";
import {
  playoffRound,
  ROUND_ABBREVIATIONS,
  ROUND_NAMES,
  weekName,
} from "~/lib/season-calendar";
import { cn } from "~/lib/utils";

function WeekButton({
  entry,
  week,
  currentWeek,
  totalWeeks,
  cell,
  onChange,
}: {
  entry: number;
  week: number;
  currentWeek: number;
  totalWeeks: number;
  /** In the sheet's grid: a fingertip-sized cell, not a figure on a line. */
  cell: boolean;
  onChange: (week: number) => void;
}) {
  const round = playoffRound(totalWeeks, entry);
  const name = round ? ROUND_NAMES[round] : `Week ${entry}`;
  return (
    <button
      type="button"
      aria-pressed={entry === week}
      aria-label={entry === currentWeek ? `${name}, this week` : name}
      title={entry === currentWeek ? `${name} · This week` : name}
      onClick={() => onChange(entry)}
      className={cn(
        "relative rounded-md text-center font-mono text-xs tabular-nums transition-colors",
        cell
          ? "h-11 min-w-0"
          : // A round's name is wider than a week's number.
            cn("shrink-0 pt-2 pb-2.5", round ? "px-2" : "min-w-0 flex-1"),
        entry === week
          ? "text-ink font-semibold"
          : cn(
              "hover:text-ink",
              entry === currentWeek ? "text-ink-muted" : "text-ink-faint",
            ),
      )}
    >
      {round ? ROUND_ABBREVIATIONS[round] : entry}
      {/* Accent rule for the chosen week, a faint one for this week. */}
      {(entry === week || entry === currentWeek) && (
        <span
          className={cn(
            "absolute left-1/2 w-3 -translate-x-1/2 rounded-full",
            cell ? "bottom-1.5" : "bottom-0",
            entry === week ? "bg-accent-strong h-0.5" : "bg-ink-faint h-px",
          )}
        />
      )}
    </button>
  );
}

/**
 * Every week to pick from: on a line, the regular season and then each
 * playoff round set so far, sharing its width so it never scrolls; as a
 * grid, the weeks in rows of nine and the rounds beneath.
 */
export function WeekChooser({
  week,
  weeks,
  currentWeek,
  totalWeeks,
  grid,
  onChange,
}: {
  week: number;
  weeks: readonly number[];
  currentWeek: number;
  totalWeeks: number;
  grid: boolean;
  onChange: (week: number) => void;
}) {
  const regular = weeks.filter((entry) => entry <= totalWeeks);
  const rounds = weeks.filter((entry) => entry > totalWeeks);
  const button = (entry: number) => (
    <WeekButton
      key={entry}
      entry={entry}
      week={week}
      currentWeek={currentWeek}
      totalWeeks={totalWeeks}
      cell={grid}
      onChange={onChange}
    />
  );

  if (grid) {
    return (
      <div role="group" aria-label="Week" className="flex flex-col gap-px">
        <div className="grid grid-cols-9 gap-px">{regular.map(button)}</div>
        {rounds.length > 0 && (
          <div className="grid grid-cols-4 gap-px">{rounds.map(button)}</div>
        )}
      </div>
    );
  }
  return (
    <div role="group" aria-label="Week" className="flex min-w-0 gap-px">
      {regular.map(button)}
      {rounds.length > 0 && (
        <span aria-hidden className="bg-edge mx-1 my-2 w-px shrink-0" />
      )}
      {rounds.map(button)}
    </div>
  );
}

/**
 * A phone's week chooser, along the bottom within reach of a thumb: the week
 * before and after either side of the shown week's name and days, which
 * opens every week as a sheet; picking one closes it.
 */
export function WeekStepper({
  week,
  weeks,
  days,
  currentWeek,
  totalWeeks,
  onChange,
}: {
  week: number;
  weeks: readonly number[];
  /** The shown week's days, "Oct 15–19"; null with no games to date it. */
  days: string | null;
  currentWeek: number;
  totalWeeks: number;
  onChange: (week: number) => void;
}) {
  const index = weeks.indexOf(week);
  const before = weeks[index - 1];
  const after = index === -1 ? undefined : weeks[index + 1];
  const go = (to: number | undefined) =>
    to === undefined ? null : () => onChange(to);

  return (
    <div className="bg-surface sticky bottom-0 mt-auto sm:hidden">
      <StepperBar
        onBack={go(before)}
        onNext={go(after)}
        sheetLabel="Weeks"
        sheet={(close) => (
          <div className="px-3 pt-1 pb-2">
            <WeekChooser
              week={week}
              weeks={weeks}
              currentWeek={currentWeek}
              totalWeeks={totalWeeks}
              grid
              onChange={(entry) => {
                onChange(entry);
                close();
              }}
            />
          </div>
        )}
      >
        <span className="text-ink truncate font-semibold">
          {weekName(totalWeeks, week)}
          {days && (
            <span className="text-ink-muted font-normal">
              {" · "}
              {days}
            </span>
          )}
        </span>
      </StepperBar>
    </div>
  );
}
