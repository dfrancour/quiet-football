"use client";

import { useEffect, useRef } from "react";
import { TeamLogo } from "~/components/team/TeamLogo";
import { useTimeZone } from "~/hooks/useTimeZone";
import { formatShortDate } from "~/lib/dates";
import { useBroadcastClock, useBroadcastDelay } from "~/hooks/useBroadcast";
import { broadcastPhase } from "~/lib/broadcast-delay";
import { gamePhase, matchupLabel } from "~/lib/schedule";
import { ROUND_ABBREVIATIONS, ROUND_NAMES } from "~/lib/season-calendar";
import { resultVisibility } from "~/lib/spoilers";
import { type TeamGame, type TeamSchedule } from "~/lib/team-view";
import { cn } from "~/lib/utils";

interface ScheduleSelectorProps {
  schedule: TeamSchedule;
  selectedGameId: string | null;
  onSelect: (gameId: string) => void;
  /** Whether a game's result is shown: caught up through it, or uncovered. */
  isShown: (game: TeamGame) => boolean;
  /** Null until the clock mounts; live markers wait for it. */
  now: number | null;
}

type Row =
  | { kind: "game"; week: number; game: TeamGame }
  | { kind: "bye"; week: number };

/** The regular season week by week, then any playoff games. */
function buildRows(schedule: TeamSchedule): Row[] {
  const byWeek = new Map<number, TeamGame>();
  for (const game of schedule.games) byWeek.set(game.week, game);

  const rows: Row[] = [];
  for (let week = 1; week <= schedule.totalWeeks; week += 1) {
    const game = byWeek.get(week);
    if (game) rows.push({ kind: "game", week, game });
    else if (schedule.byeWeeks.includes(week)) rows.push({ kind: "bye", week });
  }
  for (const game of schedule.games) {
    if (game.round !== null) rows.push({ kind: "game", week: game.week, game });
  }
  return rows;
}

/** The week column: its number, or the round abbreviated. */
function WeekCell({ game, week }: { game: TeamGame | null; week: number }) {
  if (!game?.round) return <>{week}</>;
  return (
    <abbr title={ROUND_NAMES[game.round]} className="no-underline">
      {ROUND_ABBREVIATIONS[game.round]}
    </abbr>
  );
}

/**
 * A played game's result, or "Final" while spoilers are hidden, however far
 * the viewer has watched. A game seen to the end shows its result.
 */
function StatusCell({
  game,
  showSpoilers,
  isLive,
}: {
  game: TeamGame;
  showSpoilers: boolean;
  isLive: boolean;
}) {
  // A game held back to match a broadcast is live until that broadcast ends.
  const broadcastClock = useBroadcastClock(
    game.gameId,
    useBroadcastDelay(game.gameId),
  );
  if (
    isLive ||
    (game.status === "final" &&
      broadcastPhase("final", broadcastClock) === "live")
  ) {
    return (
      <span className="text-live inline-flex items-center gap-1 text-xs font-semibold">
        <span className="bg-live animate-pulse-dot size-1.5 rounded-full" />
        LIVE
      </span>
    );
  }

  const visibility = resultVisibility(game, showSpoilers);

  if (visibility.kind === "result") {
    const { outcome, teamScore, opponentScore } = visibility;
    const prefix = outcome === "win" ? "W" : outcome === "loss" ? "L" : "T";
    return (
      <span
        className={cn(
          "font-mono text-xs font-semibold tabular-nums",
          outcome === "win" && "text-win",
          outcome === "loss" && "text-loss",
          outcome === "tie" && "text-ink-muted",
        )}
      >
        {prefix} {teamScore}-{opponentScore}
      </span>
    );
  }

  if (visibility.kind === "label") {
    return <span className="text-ink-faint text-xs">{visibility.text}</span>;
  }

  return null;
}

/**
 * The season schedule, playoff games after it; picking a row selects the
 * detail panel's game. Only the result column reacts to the spoiler switch
 * (the caller leaves out playoff games not yet to be seen).
 */
export function ScheduleSelector({
  schedule,
  selectedGameId,
  onSelect,
  isShown,
  now,
}: ScheduleSelectorProps) {
  const rows = buildRows(schedule);
  // A round's abbreviation is wider than a week's number.
  const weekWidth = schedule.games.some((game) => game.round !== null)
    ? "w-8"
    : "w-5";
  const timeZone = useTimeZone();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the selected week in view by scrolling the list, not the page.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !selected || list.scrollHeight <= list.clientHeight) return;

    // The list is positioned, so offsets are measured from its top.
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [selectedGameId]);

  return (
    <ul
      ref={listRef}
      aria-label={`${schedule.season} schedule`}
      className="divide-edge/60 relative min-h-0 divide-y overflow-y-auto overscroll-contain"
      role="list"
    >
      {rows.map((row) => {
        if (row.kind === "bye") {
          return (
            <li
              key={`bye-${row.week}`}
              className="flex items-center gap-3 py-1.5 pr-1 pl-3"
            >
              <span
                className={cn(
                  "text-ink-faint shrink-0 font-mono text-xs",
                  weekWidth,
                )}
              >
                {row.week}
              </span>
              <span className="size-5 shrink-0" aria-hidden />
              <span className="text-ink-faint text-sm italic">Bye</span>
            </li>
          );
        }

        const { game } = row;
        const isSelected = game.gameId === selectedGameId;
        const isLive = now !== null && gamePhase(game, now) === "live";

        return (
          <li key={game.gameId}>
            {/* Selection is an edge rule, not a fill, so it never outweighs
                the detail panel. */}
            <button
              type="button"
              onClick={() => onSelect(game.gameId)}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "relative flex w-full cursor-pointer items-center gap-3 rounded-sm py-1.5 pr-1 pl-3 text-left transition-colors",
                isSelected
                  ? "before:bg-accent-strong before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full"
                  : "hover:bg-surface-raised/60",
              )}
            >
              <span
                className={cn(
                  "shrink-0 font-mono text-xs",
                  weekWidth,
                  isSelected ? "text-ink" : "text-ink-faint",
                )}
              >
                <WeekCell game={game} week={row.week} />
              </span>

              <TeamLogo team={game.opponent} />

              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  isSelected ? "text-ink font-semibold" : "text-ink-muted",
                )}
              >
                {matchupLabel(game)}
              </span>

              <span className="text-ink-faint shrink-0 text-xs whitespace-nowrap">
                {/* Always shown, regardless of the spoiler switch. */}
                {formatShortDate(game.kickoff, timeZone) ?? "TBD"}
              </span>

              <span className="min-w-14 shrink-0 text-right">
                <StatusCell
                  game={game}
                  showSpoilers={isShown(game)}
                  isLive={isLive}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
