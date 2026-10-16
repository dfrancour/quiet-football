"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TeamLogo } from "~/components/team/TeamLogo";
import {
  driveSeries,
  drivesByQuarter,
  scoreByDrive,
  type DriveScore,
} from "~/lib/plays";
import {
  type Drive,
  type Play,
  type PlayOutcome,
  type Series,
} from "~/lib/plays.schema";
import { periodLabel, periodName } from "~/lib/score";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

interface PlayFeedProps {
  drives: Drive[];
  home: Team;
  away: Team;
  /** A game under way reads newest first; a finished one, from kickoff. */
  newestFirst: boolean;
  /** Marked and kept in view. */
  selectedId?: string | null;
  onSelect?: (playId: string) => void;
  /**
   * While set, this drive is open and the rest stay shut unless opened by
   * hand, so a replay folds each drive away as it passes.
   */
  following?: { driveId: string | null };
}

const OUTCOMES: Record<PlayOutcome, { label: string; tone: string }> = {
  touchdown: { label: "Touchdown", tone: "text-gold" },
  fieldGoal: { label: "Field goal", tone: "text-gold" },
  safety: { label: "Safety", tone: "text-gold" },
  noGood: { label: "No good", tone: "text-ink-muted" },
  punt: { label: "Punt", tone: "text-ink-muted" },
  interception: { label: "Interception", tone: "text-loss" },
  fumble: { label: "Fumble", tone: "text-loss" },
};

/** Outcome, a turnover the outcome does not name, and a penalty. */
function PlayTags({ play }: { play: Play }) {
  const outcome = play.outcome ? OUTCOMES[play.outcome] : null;
  const namesTurnover =
    play.outcome === "interception" || play.outcome === "fumble";
  return (
    <>
      {outcome && <span className={outcome.tone}>{outcome.label}</span>}
      {play.turnover && !namesTurnover && (
        <span className="text-loss">Turnover</span>
      )}
      {play.penalty && <span className="text-gold">Penalty</span>}
    </>
  );
}

function hasTags(play: Play): boolean {
  return play.outcome !== null || play.turnover || play.penalty;
}

/** "Q2 4:31". */
export function playTime(play: Play): string {
  const period = play.period === null ? null : periodLabel(play.period);
  return [period, play.clock].filter(Boolean).join(" ");
}

/** Headline and time, ESPN's full text, then the down and any tags. */
function PlayRow({
  play,
  selected,
  onSelect,
}: {
  play: Play;
  selected: boolean;
  onSelect?: (playId: string) => void;
}) {
  const body =
    play.kind === "stoppage" ? (
      <span className="text-ink-faint block text-xs italic">{play.text}</span>
    ) : (
      <span className="block min-w-0 space-y-0.5">
        <span className="flex items-baseline gap-3">
          <span className="text-ink min-w-0 flex-1 truncate text-sm font-semibold">
            {play.headline}
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-xs tabular-nums",
              selected ? "text-scrimmage" : "text-ink-faint",
            )}
          >
            {playTime(play)}
          </span>
        </span>
        <span className="text-ink-muted block text-xs leading-relaxed">
          {play.text}
        </span>
        {(play.downDistance || hasTags(play)) && (
          <span className="flex flex-wrap items-center gap-x-2 font-mono text-xs">
            {play.downDistance && (
              <span className="text-ink-faint">{play.downDistance}</span>
            )}
            <PlayTags play={play} />
          </span>
        )}
      </span>
    );

  const rowClass = cn(
    "block w-full rounded-r-md border-l-2 py-1.5 pr-1 pl-3 text-left",
    play.scoring ? "border-gold" : "border-transparent",
    selected && "bg-surface-sunken",
    !play.scoring && selected && "border-scrimmage",
  );

  return (
    <li data-play-id={play.id}>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(play.id)}
          aria-pressed={selected}
          className={cn(
            rowClass,
            "hover:bg-surface-sunken/60 cursor-pointer transition-colors",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** A rule between sets of downs, saying how the first down was earned. */
function FirstDown({
  gainedBy,
}: {
  gainedBy: NonNullable<Series["gainedBy"]>;
}) {
  const byPenalty = gainedBy === "penalty";
  return (
    <li
      role="separator"
      aria-label={byPenalty ? "First down by penalty" : "First down"}
      className="border-l-2 border-transparent py-1.5 pl-3"
    >
      <span className="flex items-center gap-2">
        <span className="bg-edge-strong h-px w-3 shrink-0" />
        <span className="text-ink-muted font-mono text-[0.6875rem] font-semibold tracking-wider uppercase">
          1st down
          {byPenalty && <span className="text-gold"> · penalty</span>}
        </span>
        <span className="bg-edge-strong h-px w-16 shrink-0" />
      </span>
    </li>
  );
}

/**
 * Where a quarter begins: above its drives from kickoff, beneath them when
 * read newest first.
 */
function QuarterRule({ period, below }: { period: number; below: boolean }) {
  const rule = (
    <>
      <span className="text-ink-muted label-eyebrow shrink-0">
        {periodName(period)}
      </span>
      <span className="bg-edge h-px flex-1" aria-hidden />
    </>
  );
  return below ? (
    <li
      role="separator"
      aria-label={`${periodName(period)} begins`}
      className="flex items-center gap-3 pt-1 pb-3"
    >
      {rule}
    </li>
  ) : (
    <li>
      <h2 className="flex items-center gap-3 pt-3 pb-1">{rule}</h2>
    </li>
  );
}

/** One side's figure in a drive's score, gold when the drive put it up. */
function SideScore({
  team,
  points,
  rose,
}: {
  team: Team;
  points: number;
  rose: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-ink-faint">{team.abbreviation}</span>
      <span className={rose ? "text-gold font-semibold" : "text-ink-muted"}>
        {points}
      </span>
    </span>
  );
}

/** Result, then description, with the score after it (away first). */
function DriveSummary({
  drive,
  score,
  home,
  away,
}: {
  drive: Drive;
  score: DriveScore | null;
  home: Team;
  away: Team;
}) {
  const offense =
    drive.offense === "home" ? home : drive.offense === "away" ? away : null;
  return (
    <>
      {/* The mark is all that names the offense, so it is read out. */}
      {offense && <TeamLogo team={offense} size="md" labelled />}
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "text-sm font-semibold",
            drive.inProgress
              ? "text-live"
              : drive.isScore
                ? "text-gold"
                : "text-ink",
          )}
        >
          {drive.inProgress ? "On the field" : (drive.result ?? "—")}
        </span>
        {drive.description && (
          <span className="text-ink-faint truncate font-mono text-xs">
            {drive.description}
          </span>
        )}
      </span>
      {score && (
        <span className="ml-auto flex shrink-0 gap-2.5 pl-2 font-mono text-xs tabular-nums">
          <SideScore
            team={away}
            points={score.after.away}
            rose={score.after.away > score.before.away}
          />
          <SideScore
            team={home}
            points={score.after.home}
            rose={score.after.home > score.before.home}
          />
        </span>
      )}
    </>
  );
}

/** Always returns a new array. */
function ordered<T>(items: T[], newestFirst: boolean): T[] {
  return newestFirst ? [...items].reverse() : [...items];
}

/**
 * Scrolls a row into view only when the list scrolls itself, never the page,
 * so the field stays in sight on a phone.
 */
function keepInView(list: HTMLElement, row: HTMLElement): void {
  if (list.scrollHeight <= list.clientHeight) return;
  const bounds = list.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  if (box.top < bounds.top) list.scrollTop -= bounds.top - box.top;
  else if (box.bottom > bounds.bottom) {
    list.scrollTop += box.bottom - bounds.bottom;
  }
}

/**
 * The game drive by drive, with rules at each quarter and first down.
 *
 * The drive holding the selected play is open; others toggle by hand.
 *
 * A spoiler; the caller renders it only when allowed.
 *
 * From md up the drives scroll on their own, so a flex-column parent can bound
 * the feed's height.
 */
export function PlayFeed({
  drives,
  home,
  away,
  newestFirst,
  selectedId = null,
  onSelect,
  following,
}: PlayFeedProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // Only a new selection scrolls: the drives are rebuilt on every render while
  // the result is hidden and on every poll while live, and following them
  // would pull the list back each time the viewer scrolled away.
  useEffect(() => {
    const list = listRef.current;
    if (!list || selectedId === null) return;
    const row = [...list.querySelectorAll<HTMLElement>("[data-play-id]")].find(
      (candidate) => candidate.dataset.playId === selectedId,
    );
    if (row) keepInView(list, row);
  }, [selectedId]);

  if (drives.length === 0) return null;

  const newestId = drives.at(-1)?.id;
  const scores = scoreByDrive(drives);
  const isOpen = (drive: Drive) => {
    const holdsSelection = drive.plays.some((play) => play.id === selectedId);
    if (following) {
      return drive.id === following.driveId || toggled[drive.id] === true;
    }
    // Keep the selection's drive open so arrow keys never land in a fold.
    return (
      holdsSelection ||
      (toggled[drive.id] ?? (newestFirst && drive.id === newestId))
    );
  };

  const rows = (drive: Drive): ReactNode[] =>
    ordered(driveSeries(drive), newestFirst).flatMap((set) => {
      const plays = ordered(set.plays, newestFirst).map((play) => (
        <PlayRow
          key={play.id}
          play={play}
          selected={play.id === selectedId}
          onSelect={onSelect}
        />
      ));
      const rule = set.gainedBy && (
        <FirstDown
          key={`first-down-${set.plays[0]?.id}`}
          gainedBy={set.gainedBy}
        />
      );
      return newestFirst ? [...plays, rule] : [rule, ...plays];
    });

  return (
    <section
      aria-label="Play-by-play"
      className="mt-3 md:flex md:min-h-40 md:flex-col"
    >
      <ol
        ref={listRef}
        className="space-y-1 md:min-h-0 md:overflow-y-auto md:overscroll-contain"
      >
        {ordered(drivesByQuarter(drives), newestFirst).flatMap((group) => {
          const rule = group.period !== null && (
            <QuarterRule
              key={`quarter-${group.period}`}
              period={group.period}
              below={newestFirst}
            />
          );
          const items = ordered(group.drives, newestFirst).map((drive) => {
            const open = isOpen(drive);
            return (
              <li key={drive.id}>
                <details className="group" open={open}>
                  <summary
                    onClick={(event) => {
                      event.preventDefault();
                      setToggled((current) => ({
                        ...current,
                        [drive.id]: !open,
                      }));
                    }}
                    className="hover:bg-surface-sunken flex cursor-pointer list-none items-center gap-2.5 rounded-md px-1 py-1.5 [&::-webkit-details-marker]:hidden"
                  >
                    <DriveSummary
                      drive={drive}
                      score={scores.get(drive.id) ?? null}
                      home={home}
                      away={away}
                    />
                  </summary>
                  <ol className="mt-1 mb-2 ml-1">{rows(drive)}</ol>
                </details>
              </li>
            );
          });
          return newestFirst ? [...items, rule] : [rule, ...items];
        })}
      </ol>
    </section>
  );
}
