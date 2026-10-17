"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Redacted } from "~/components/common/Redacted";
import { Sheet } from "~/components/common/Sheet";
import { CoveredTeam } from "~/components/playoffs/CoveredTeam";
import { TeamLogo } from "~/components/team/TeamLogo";
import { useNow } from "~/hooks/useNow";
import { useBroadcastClock, useBroadcastDelay } from "~/hooks/useBroadcast";
import { broadcastPhase } from "~/lib/broadcast-delay";
import { useTimeZone } from "~/hooks/useTimeZone";
import {
  dayKey,
  formatDayRange,
  formatLongDate,
  formatTime,
} from "~/lib/dates";
import { type GateGame } from "~/lib/playoffs";
import { teamPath } from "~/lib/routes";
import { formatRecord, gamePhase, type GamePhase } from "~/lib/schedule";
import {
  playoffRound,
  ROUND_ABBREVIATIONS,
  ROUND_NAMES,
  weekName,
  weekParam,
} from "~/lib/season-calendar";
import { type BoardGame } from "~/lib/score.schema";
import { maskedScore, spoilerSafeClock } from "~/lib/spoilers";
import { type WeekGame, type WeekSide } from "~/lib/week";
import { cn } from "~/lib/utils";

interface WeekScheduleProps {
  /** The whole season's games; the chooser picks which week is shown. */
  games: WeekGame[];
  /** The week shown. */
  week: number;
  /** The shown week's scoreboard: each game's clock and score as of now. */
  board: readonly BoardGame[];
  onWeekChange: (week: number) => void;
  /** The week the clock says is on now: marked in the chooser. */
  currentWeek: number;
  totalWeeks: number;
  /** Whether a game's result is shown: caught up through it, or uncovered. */
  isShown: (game: GateGame) => boolean;
  /** Whether a playoff matchup may be shown (`playoffs.ts`). */
  isOpen: (gate: readonly GateGame[]) => boolean;
  /** Whether the records going into a week's games give nothing away. */
  showsRecordsBefore: (week: number) => boolean;
  /** Teams pointed at elsewhere on the page; their games light up. */
  highlighted: ReadonlySet<string>;
  /** The viewer's team, whose game is tinted; null if they have none. */
  favoriteTeamId: string | null;
  /** Points at a game's two teams, or at nothing. */
  onPoint: (teamIds: readonly string[]) => void;
}

interface Slot {
  key: string;
  time: string;
  games: WeekGame[];
}

interface Day {
  key: string;
  label: string;
  slots: Slot[];
}

/** Games by the viewer's local day, then by kickoff time. */
function byDayAndSlot(games: WeekGame[], timeZone: string): Day[] {
  const days: Day[] = [];
  for (const game of games) {
    const key = dayKey(game.kickoff, timeZone) ?? "TBD";
    let day = days.at(-1);
    if (day?.key !== key) {
      const label = formatLongDate(game.kickoff, timeZone) ?? "Date TBD";
      day = { key, label, slots: [] };
      days.push(day);
    }
    const slot = day.slots.at(-1);
    if (slot?.key === game.kickoff) slot.games.push(game);
    else
      day.slots.push({
        key: game.kickoff,
        time: formatTime(game.kickoff, timeZone) ?? "TBD",
        games: [game],
      });
  }
  return days;
}

/**
 * What a row says in its last column: the network, the game's own clock, or
 * Final, however far the viewer has watched.
 */
function Status({
  game,
  phase: storedPhase,
  board,
  revealed,
}: {
  game: WeekGame;
  phase: GamePhase | null;
  board: BoardGame | undefined;
  revealed: boolean;
}) {
  // A game held back to match a broadcast reads as that broadcast has it.
  const broadcastClock = useBroadcastClock(
    game.gameId,
    useBroadcastDelay(game.gameId),
  );
  const phase = storedPhase && broadcastPhase(storedPhase, broadcastClock);
  const clock = broadcastClock ?? board;
  if (phase === "live") {
    return (
      <span className="text-live flex items-center gap-1.5 font-semibold whitespace-nowrap">
        <span className="bg-live animate-pulse-dot size-1.5 shrink-0 rounded-full" />
        {clock ? spoilerSafeClock(clock, revealed) : "LIVE"}
      </span>
    );
  }
  if (phase === "final") {
    // "Final/OT" says the game was close, so it waits for the result too.
    return (
      <span className="text-ink-faint">
        {revealed && board?.completed ? board.detail : "Final"}
      </span>
    );
  }
  if (phase === "postponed" || phase === "canceled") {
    return <span className="text-loss capitalize">{phase}</span>;
  }
  return <span className="text-ink-muted">{game.broadcast ?? ""}</span>;
}

/** A side's team and score as one link; the away side is mirrored. */
function TeamCell({
  side,
  score,
  href,
  align,
  leading,
  showRecord,
}: {
  side: WeekSide;
  /** Null while hidden; empty before the game starts. */
  score: string | null;
  href: string;
  align: "end" | "start";
  leading: boolean;
  showRecord: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // The overlay makes the whole cell one target and focus ring.
        "focus-visible:after:outline-accent-strong flex items-center gap-2 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2",
        align === "end" && "flex-row-reverse",
      )}
    >
      <span
        className={cn(
          "w-8 shrink-0 text-center font-mono tabular-nums",
          leading ? "text-ink font-semibold" : "text-ink-muted",
        )}
      >
        {score ?? <Redacted />}
      </span>
      <TeamLogo team={side.team} />
      <span
        className={cn(
          "font-mono tracking-wide",
          leading ? "text-ink font-semibold" : "text-ink-muted",
        )}
      >
        {side.team.abbreviation}
      </span>
      {/* A record going in reveals earlier results. */}
      {showRecord && (
        <span className="text-ink-faint hidden font-mono text-xs sm:inline">
          {formatRecord(side.recordBefore)}
        </span>
      )}
    </Link>
  );
}

const teamCellClass =
  "has-[a:hover]:bg-surface-sunken relative py-2 transition-colors";

/** The slot's time, on the first row of games kicking off together. */
function SlotTime({ slot }: { slot: Slot }) {
  return (
    <th
      scope="rowgroup"
      rowSpan={slot.games.length}
      className="text-ink-muted w-16 py-1.5 pr-2 text-left align-top font-mono text-xs font-normal whitespace-nowrap"
    >
      {slot.time}
    </th>
  );
}

/**
 * A playoff game whose teams would give away a round the viewer has not
 * seen: both sides covered, nothing linked or highlighted.
 */
function CoveredRow({
  game,
  slot,
  isFirstInSlot,
  phase,
}: {
  game: WeekGame;
  slot: Slot;
  isFirstInSlot: boolean;
  phase: GamePhase | null;
}) {
  return (
    <tr
      className={cn(
        "border-edge border-t",
        isFirstInSlot && "border-edge-strong",
        phase === "live" && "bg-live/10",
      )}
    >
      {isFirstInSlot && <SlotTime slot={slot} />}
      <td className="py-1.5">
        <span className="flex justify-end pr-10">
          <CoveredTeam />
        </span>
      </td>
      <td className="text-ink-faint w-5 text-center text-xs">@</td>
      <td className="py-1.5">
        <span className="flex pl-10">
          <CoveredTeam />
        </span>
      </td>
      <td className="w-24 py-1.5 pl-3 text-right font-mono text-xs">
        <Status game={game} phase={phase} board={undefined} revealed={false} />
      </td>
    </tr>
  );
}

function GameRow({
  game,
  slot,
  isFirstInSlot,
  phase,
  board,
  revealed,
  showRecords,
  totalWeeks,
  highlighted,
  favorite,
  onPoint,
}: {
  game: WeekGame;
  slot: Slot;
  isFirstInSlot: boolean;
  phase: GamePhase | null;
  board: BoardGame | undefined;
  revealed: boolean;
  showRecords: boolean;
  totalWeeks: number;
  highlighted: boolean;
  favorite: boolean;
  onPoint: (teamIds: readonly string[]) => void;
}) {
  const started = phase === "live" || phase === "final";
  const week = weekParam(totalWeeks, game.week);
  const awayScore = board?.away.score ?? game.away.score;
  const homeScore = board?.home.score ?? game.home.score;
  // Highlighting the leader gives a game away, so it waits for spoilers.
  const lead =
    revealed && started && awayScore !== null && homeScore !== null
      ? Math.sign(awayScore - homeScore)
      : 0;
  const score = (value: number | null) =>
    started ? maskedScore(value, revealed) : "";

  return (
    <tr
      // Hover or focus highlights both teams in the standings.
      onMouseEnter={() =>
        onPoint([game.away.team.teamId, game.home.team.teamId])
      }
      onMouseLeave={() => onPoint([])}
      onFocus={() => onPoint([game.away.team.teamId, game.home.team.teamId])}
      onBlur={() => onPoint([])}
      className={cn(
        "border-edge border-t transition-colors",
        isFirstInSlot && "border-edge-strong",
        phase === "live"
          ? "bg-live/10"
          : highlighted
            ? "bg-surface-raised"
            : favorite && "bg-accent/10",
      )}
    >
      {isFirstInSlot && <SlotTime slot={slot} />}
      <td className={teamCellClass}>
        <TeamCell
          side={game.away}
          score={score(awayScore)}
          href={teamPath(game.away.team.abbreviation, week)}
          align="end"
          leading={lead > 0}
          showRecord={showRecords}
        />
      </td>
      <td className="text-ink-faint w-5 text-center text-xs">@</td>
      <td className={teamCellClass}>
        <TeamCell
          side={game.home}
          score={score(homeScore)}
          href={teamPath(game.home.team.abbreviation, week)}
          align="start"
          leading={lead < 0}
          showRecord={showRecords}
        />
      </td>
      <td className="w-24 py-1.5 pl-3 text-right font-mono text-xs">
        <Status game={game} phase={phase} board={board} revealed={revealed} />
      </td>
    </tr>
  );
}

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
  return (
    <button
      type="button"
      aria-pressed={entry === week}
      aria-label={round ? ROUND_NAMES[round] : undefined}
      title={
        [round && ROUND_NAMES[round], entry === currentWeek && "This week"]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      onClick={() => onChange(entry)}
      className={cn(
        "relative cursor-pointer rounded-md text-center font-mono text-xs tabular-nums transition-colors",
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
function WeekChooser({
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
function WeekStepper({
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
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLButtonElement>(null);
  // Closed, focus goes back to the bar it came from.
  const close = useCallback(() => {
    setOpen(false);
    barRef.current?.focus();
  }, []);
  const index = weeks.indexOf(week);
  const before = weeks[index - 1];
  const after = index === -1 ? undefined : weeks[index + 1];
  const step = (to: number | undefined, label: string, Icon: LucideIcon) => (
    <button
      type="button"
      aria-label={label}
      disabled={to === undefined}
      onClick={() => to !== undefined && onChange(to)}
      className="text-ink-muted hover:text-ink disabled:text-ink-faint/40 flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-md transition-colors disabled:cursor-default"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );

  return (
    <div className="border-edge bg-surface sticky bottom-0 mt-auto flex items-center border-t py-1 sm:hidden">
      {step(before, "Previous week", ChevronLeft)}
      <button
        ref={barRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="hover:bg-surface-raised/60 flex h-11 min-w-0 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors"
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
        <ChevronUp className="text-ink-faint size-4 shrink-0" aria-hidden />
      </button>
      {step(after, "Next week", ChevronRight)}

      {open && (
        <Sheet label="Weeks" onClose={close}>
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
        </Sheet>
      )}
    </div>
  );
}

/**
 * One week of the league with a week chooser, playoff rounds after the
 * regular season: a line above the games, or on a phone a stepper beneath
 * them. Each side links to its team's page on that week.
 */
export function WeekSchedule({
  games,
  week,
  board,
  onWeekChange,
  currentWeek,
  totalWeeks,
  isShown,
  isOpen,
  showsRecordsBefore,
  highlighted,
  favoriteTeamId,
  onPoint,
}: WeekScheduleProps) {
  const now = useNow();
  const timeZone = useTimeZone();
  const shown = games.filter((game) => game.week === week);
  // Playoff rounds join the chooser once their matchups are set.
  const weeks = [
    ...Array.from({ length: totalWeeks }, (_, index) => index + 1),
    ...new Set(
      games
        .filter((game) => game.round !== null)
        .map((game) => game.week)
        .sort((a, b) => a - b),
    ),
  ];

  const boardById = new Map(board.map((entry) => [entry.gameId, entry]));
  const first = shown[0];
  const last = shown.at(-1);
  const days =
    first && last
      ? formatDayRange(first.kickoff, last.kickoff, timeZone)
      : null;

  return (
    // On a phone the pane scrolls and the stepper keeps to its foot.
    <div className="flex flex-col gap-4 max-sm:min-h-full">
      <div className="max-sm:hidden">
        <WeekChooser
          week={week}
          weeks={weeks}
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
          grid={false}
          onChange={onWeekChange}
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-ink-muted text-sm">No games this week.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {byDayAndSlot(shown, timeZone).map((day) => (
            <table key={day.key} className="w-full text-sm">
              <caption className="label-eyebrow pb-1.5 text-left">
                {day.label}
              </caption>
              <tbody>
                {day.slots.flatMap((slot) =>
                  slot.games.map((game, index) => {
                    // Until the clock mounts, only a stored status is trusted.
                    const phase =
                      now === null
                        ? game.status === "final"
                          ? "final"
                          : null
                        : gamePhase(game, now);
                    if (!isOpen(game.gate)) {
                      return (
                        <CoveredRow
                          key={game.gameId}
                          game={game}
                          slot={slot}
                          isFirstInSlot={index === 0}
                          phase={phase}
                        />
                      );
                    }
                    return (
                      <GameRow
                        key={game.gameId}
                        game={game}
                        slot={slot}
                        isFirstInSlot={index === 0}
                        phase={phase}
                        board={boardById.get(game.gameId)}
                        revealed={isShown(game)}
                        showRecords={showsRecordsBefore(game.week)}
                        totalWeeks={totalWeeks}
                        highlighted={
                          highlighted.has(game.away.team.teamId) ||
                          highlighted.has(game.home.team.teamId)
                        }
                        favorite={
                          favoriteTeamId === game.away.team.teamId ||
                          favoriteTeamId === game.home.team.teamId
                        }
                        onPoint={onPoint}
                      />
                    );
                  }),
                )}
              </tbody>
            </table>
          ))}
        </div>
      )}

      <WeekStepper
        week={week}
        weeks={weeks}
        days={days}
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        onChange={onWeekChange}
      />
    </div>
  );
}
