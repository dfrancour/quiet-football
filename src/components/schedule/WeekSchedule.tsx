"use client";

import Link from "next/link";
import { Redacted } from "~/components/common/Redacted";
import { CoveredTeam } from "~/components/playoffs/CoveredTeam";
import { WeekChooser, WeekStepper } from "~/components/schedule/WeekChooser";
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
import {
  formatRecord,
  gamePhase,
  type GamePhase,
  type TeamRecord,
} from "~/lib/schedule";
import { weekParam } from "~/lib/season-calendar";
import { type BoardGame } from "~/lib/score.schema";
import { scoreShown, spoilerSafeClock, type ScoreShown } from "~/lib/spoilers";
import { tintStyle } from "~/lib/team-tint";
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
  /** Whether the viewer's place in a live game is its newest play. */
  isCaughtUpLive: (gameId: string, lastPlayId: string | null) => boolean;
  /** Whether a playoff matchup may be shown (`playoffs.ts`). */
  isOpen: (gate: readonly GateGame[]) => boolean;
  /** The records a game may show beside its teams; null for none. */
  recordsFor: (game: WeekGame) => { away: TeamRecord; home: TeamRecord } | null;
  /** Teams pointed at elsewhere on the page; their games light up. */
  highlighted: ReadonlySet<string>;
  /** The viewer's teams, each tinted on its own side of a game. */
  favorites: ReadonlySet<string>;
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
  record,
}: {
  side: WeekSide;
  score: ScoreShown;
  href: string;
  align: "end" | "start";
  leading: boolean;
  /** Null while it would give a result away. */
  record: TeamRecord | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // The overlay makes the whole cell one target and focus ring.
        "focus-visible:after:outline-accent-strong flex items-center gap-1.5 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 sm:gap-2",
        align === "end" && "flex-row-reverse",
      )}
    >
      <span
        className={cn(
          "w-6 shrink-0 text-center font-mono tabular-nums sm:w-8",
          leading ? "text-ink font-semibold" : "text-ink-muted",
        )}
      >
        {score.kind === "hidden" ? (
          <Redacted />
        ) : score.kind === "shown" ? (
          score.text
        ) : null}
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
      {record && (
        <span className="text-ink-faint hidden font-mono text-xs sm:inline">
          {formatRecord(record)}
        </span>
      )}
    </Link>
  );
}

const teamCellClass =
  "has-[a:hover]:bg-surface-sunken relative py-2 transition-colors";

/**
 * The slot's time, on the first row of games kicking off together. On a
 * phone there is no room for a column of it beside the teams, so it heads
 * the slot instead (`SlotTimeRow`).
 */
function SlotTime({ slot }: { slot: Slot }) {
  return (
    <th
      scope="rowgroup"
      rowSpan={slot.games.length}
      className="text-ink-muted w-16 py-1.5 pr-2 text-left align-top font-mono text-xs font-normal whitespace-nowrap max-sm:hidden"
    >
      {slot.time}
    </th>
  );
}

/** A phone's time, as a line above the games kicking off together. */
function SlotTimeRow({ slot }: { slot: Slot }) {
  return (
    <tr className="sm:hidden">
      <th
        scope="rowgroup"
        colSpan={4}
        className="text-ink-muted pt-1 pb-1 text-left font-mono text-xs font-normal whitespace-nowrap"
      >
        {slot.time}
      </th>
    </tr>
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
      <td className="w-20 py-1.5 pl-2 text-right font-mono text-xs sm:w-24 sm:pl-3">
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
  records,
  totalWeeks,
  highlighted,
  favorites,
  onPoint,
}: {
  game: WeekGame;
  slot: Slot;
  isFirstInSlot: boolean;
  phase: GamePhase | null;
  board: BoardGame | undefined;
  revealed: boolean;
  records: { away: TeamRecord; home: TeamRecord } | null;
  totalWeeks: number;
  highlighted: boolean;
  favorites: ReadonlySet<string>;
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
  const score = (value: number | null) => scoreShown(started, value, revealed);
  // A favorite's own side of the game is tinted, not the whole row.
  const sideCell = (side: WeekSide) =>
    favorites.has(side.team.teamId)
      ? {
          className: cn(teamCellClass, "team-tint"),
          style: tintStyle(side.team),
        }
      : { className: teamCellClass };

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
        phase === "live" ? "bg-live/10" : highlighted && "bg-surface-raised",
      )}
    >
      {isFirstInSlot && <SlotTime slot={slot} />}
      <td {...sideCell(game.away)}>
        <TeamCell
          side={game.away}
          score={score(awayScore)}
          href={teamPath(game.away.team.abbreviation, week)}
          align="end"
          leading={lead > 0}
          record={records?.away ?? null}
        />
      </td>
      <td className="text-ink-faint w-5 text-center text-xs">@</td>
      <td {...sideCell(game.home)}>
        <TeamCell
          side={game.home}
          score={score(homeScore)}
          href={teamPath(game.home.team.abbreviation, week)}
          align="start"
          leading={lead < 0}
          record={records?.home ?? null}
        />
      </td>
      <td className="w-20 py-1.5 pl-2 text-right font-mono text-xs sm:w-24 sm:pl-3">
        <Status game={game} phase={phase} board={board} revealed={revealed} />
      </td>
    </tr>
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
  isCaughtUpLive,
  isOpen,
  recordsFor,
  highlighted,
  favorites,
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
        // One table for every day, so the columns, and the @ between the
        // teams, line up from one day to the next.
        <table className="w-full text-sm">
          {byDayAndSlot(shown, timeZone).map((day, dayIndex) => (
            <tbody key={day.key}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={5}
                  className={cn(
                    "label-eyebrow pb-1.5 text-left",
                    dayIndex > 0 && "pt-5",
                  )}
                >
                  {day.label}
                </th>
              </tr>
              {day.slots.flatMap((slot) => [
                <SlotTimeRow key={`time-${slot.key}`} slot={slot} />,
                ...slot.games.map((game, index) => {
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
                  const board = boardById.get(game.gameId);
                  return (
                    <GameRow
                      key={game.gameId}
                      game={game}
                      slot={slot}
                      isFirstInSlot={index === 0}
                      phase={phase}
                      board={board}
                      // A live game followed to its newest play is seen
                      // as far as the scoreboard goes.
                      revealed={
                        isShown(game) ||
                        (phase === "live" &&
                          isCaughtUpLive(
                            game.gameId,
                            board?.lastPlayId ?? null,
                          ))
                      }
                      records={recordsFor(game)}
                      totalWeeks={totalWeeks}
                      highlighted={
                        highlighted.has(game.away.team.teamId) ||
                        highlighted.has(game.home.team.teamId)
                      }
                      favorites={favorites}
                      onPoint={onPoint}
                    />
                  );
                }),
              ])}
            </tbody>
          ))}
        </table>
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
