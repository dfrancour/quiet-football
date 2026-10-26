"use client";

import { useMemo, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { FieldView } from "~/components/game/FieldView";
import {
  ScoreRow,
  figuresAt,
  sideStanding,
  sides,
} from "~/components/game/ScoreRow";
import { GamePlays } from "~/components/game/GamePlays";
import { RecapLink } from "~/components/recap/RecapLink";
import { TeamLogo } from "~/components/team/TeamLogo";
import {
  useBroadcastClock,
  useBroadcastDelay,
  useBroadcastDrives,
} from "~/hooks/useBroadcast";
import { useReplay } from "~/hooks/useReplay";
import { useTimeZone } from "~/hooks/useTimeZone";
import { useWakeLock } from "~/hooks/useWakeLock";
import {
  useKeepWatchProgress,
  useWatchProgress,
} from "~/hooks/useWatchProgress";
import { playsInOrder } from "~/lib/plays";
import { formatDateTime } from "~/lib/dates";
import { type PlayByPlay } from "~/lib/plays.schema";
import { findRecap, type Recap, type RecapsFile } from "~/lib/recaps";
import { type LiveScore, type SituationState } from "~/lib/score.schema";
import {
  formatAge,
  formatRecord,
  formatCountdown,
  gamePhase,
  matchupLabel,
  weekLabel,
  type TeamRecord,
} from "~/lib/schedule";
import { broadcastPhase, cycleBroadcastDelay } from "~/lib/broadcast-delay";
import { maskedScore, spoilerSafeClock } from "~/lib/spoilers";
import { type TeamGame } from "~/lib/team-view";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";
import { finishGame } from "~/lib/watch-progress";

interface GameDetailProps {
  game: TeamGame | null;
  /** Null until the clock mounts; the panel waits rather than guess. */
  now: number | null;
  team: Team;
  score: LiveScore | null;
  scoreError: string | null;
  /** When the score last arrived, for the freshness readout. */
  scoreUpdatedAt?: number | null;
  /** Caught up through its week; a game seen to the end is shown too. */
  showSpoilers: boolean;
  /** Each side's record, or null while it would give a result away. */
  records?: { team: TeamRecord; opponent: TeamRecord } | null;
  recaps: RecapsFile;
  /** With spoilers hidden, shown only as far as the viewer has watched. */
  playByPlay?: PlayByPlay | null;
  /**
   * Given while the plays have not been asked for: the viewer's first move
   * to watch asks for them. Resolves to the plays, or null if none came.
   */
  onLoadPlays?: () => Promise<PlayByPlay | null>;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

/** The team's own record is in the page's header; the opponent's is here. */
function Matchup({
  game,
  team,
  opponentRecord,
}: {
  game: TeamGame;
  team: Team;
  opponentRecord: TeamRecord | null;
}) {
  const { away, home } = sides(game, team);

  return (
    <div className="flex items-center gap-3">
      <span className="flex shrink-0 items-center gap-1">
        <TeamLogo team={away} size="lg" />
        <span className="text-ink-faint font-mono text-xs" aria-hidden>
          at
        </span>
        <TeamLogo team={home} size="lg" />
      </span>

      <div className="min-w-0">
        <p className="text-ink text-2xl font-semibold">{matchupLabel(game)}</p>
        <p className="text-ink-muted mt-0.5 text-sm">
          {game.opponent.displayName}
          {opponentRecord && (
            <>
              <Dot />
              <span className="font-mono">{formatRecord(opponentRecord)}</span>
            </>
          )}
          {game.neutralSite && (
            <>
              <Dot />
              neutral site
            </>
          )}
        </p>
        <p className="sr-only">
          {team.displayName}, {weekLabel(game)}
        </p>
      </div>
    </div>
  );
}

/** A middle dot between a footnote's parts. */
function Dot() {
  return (
    <span aria-hidden className="mx-1.5">
      ·
    </span>
  );
}

/**
 * When and on what, as one line: a footnote under a game that has been
 * played, and `leading` for a game to come, where it is what there is to say.
 * No venue: the matchup says who is home.
 */
function Meta({
  game,
  leading = false,
}: {
  game: TeamGame;
  leading?: boolean;
}) {
  const timeZone = useTimeZone();
  return (
    <p
      className={cn(
        "leading-relaxed",
        leading ? "text-ink-muted text-sm" : "text-ink-faint text-xs",
      )}
    >
      <span className="whitespace-nowrap">
        <span className="sr-only">Kickoff </span>
        {formatDateTime(game.kickoff, timeZone) ?? "Date TBD"}
      </span>
      {game.broadcast && (
        <>
          <Dot />
          <span className="whitespace-nowrap">{game.broadcast}</span>
        </>
      )}
    </p>
  );
}

/**
 * Field and last play from the scoreboard alone, before play-by-play arrives.
 * A spoiler; the caller renders it only when spoilers are shown.
 */
function Situation({
  situation,
  game,
  team,
}: {
  situation: SituationState;
  game: TeamGame;
  team: Team;
}) {
  const { downDistance, isRedZone, field, lastPlay, drive } = situation;
  const { away, home } = sides(game, team);

  return (
    <div className="mt-4 space-y-2">
      {downDistance && (
        <p className="flex items-center gap-2">
          <span className="text-ink text-sm font-semibold tabular-nums">
            {downDistance}
          </span>
          {isRedZone && (
            <span className="text-live label-eyebrow">Red zone</span>
          )}
        </p>
      )}
      <FieldView home={home} away={away} field={field} />
      {lastPlay && <p className="text-ink-muted text-sm">{lastPlay}</p>}
      {drive && <p className="text-ink-faint text-xs tabular-nums">{drive}</p>}
    </div>
  );
}

/**
 * With the result hidden, the label is the way back to the newest play; the
 * hover state is the only hint. `clock` is the game's own, for when the score
 * row stands at an earlier play.
 */
function LiveLabel({
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
      className={cn(
        className,
        "-m-2 cursor-pointer rounded-md p-2 hover:brightness-125",
      )}
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
function FinalLabel({
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
      className="text-ink-faint hover:text-ink -m-2 cursor-pointer rounded-md p-2 whitespace-nowrap transition-colors"
      aria-label={`${weekLabel(game)}, final: see the game to the end`}
      title="See to the end"
    >
      {label}
    </button>
  );
}

interface ExpandControl {
  expanded: boolean;
  onToggleExpanded?: () => void;
}

function Eyebrow({
  children,
  expanded,
  onToggleExpanded,
  recap = null,
}: {
  children: ReactNode;
  /** A finished game's recap, once the dataset has one. */
  recap?: Recap | null;
} & ExpandControl) {
  const Icon = expanded ? Minimize2 : Maximize2;
  const label = expanded ? "Exit full screen" : "Full screen";
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        {children}
      </div>
      {recap && <RecapLink recap={recap} />}
      {onToggleExpanded && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-ink-faint hover:text-ink -m-2 shrink-0 cursor-pointer rounded-md p-2 transition-colors"
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

function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  // The inset holds the top row's oversized hit areas (8px past their glyphs)
  // inside the column, which scrolls sideways if anything pokes out.
  return <section className={cn("px-2", className)}>{children}</section>;
}

/**
 * Everything shown about the selected game, branched on its phase.
 *
 * Nothing reveals a result the viewer has not seen, including which side is
 * emphasized: hidden, a game is shown as far as the viewer's place in it.
 * Following a live game is being at its newest play, and pausing leaves the
 * place where it stopped. Tapping the covered score sees a finished game to
 * the end, or joins a live one at its newest play.
 */
export function GameDetail({
  game,
  now,
  team,
  score,
  scoreError,
  scoreUpdatedAt = null,
  showSpoilers: caughtUp,
  records = null,
  recaps,
  playByPlay = null,
  onLoadPlays,
  expanded = false,
  onToggleExpanded,
}: GameDetailProps) {
  const expand = { expanded, onToggleExpanded };
  const gameId = game?.gameId ?? null;
  const allDrives =
    game && playByPlay?.gameId === game.gameId ? playByPlay.drives : null;
  const allPlays = useMemo(() => playsInOrder(allDrives ?? []), [allDrives]);

  // A viewer matching a broadcast holds the game back: its plays, its clock,
  // and its end.
  const delayMs = useBroadcastDelay(gameId);
  const broadcastClock = useBroadcastClock(gameId, delayMs);
  const ongoing =
    game !== null &&
    now !== null &&
    broadcastPhase(gamePhase(game, now), broadcastClock) === "live";

  // With spoilers hidden, a game is open only as far as it has been watched.
  const stored = useWatchProgress(gameId, allPlays);
  const showSpoilers = caughtUp || stored?.finished === true;
  const drives = useBroadcastDrives(
    allDrives,
    delayMs,
    ongoing,
    stored?.playId ?? null,
  );
  const plays = useMemo(() => playsInOrder(drives ?? []), [drives]);
  const replay = useReplay(
    gameId,
    drives,
    ongoing,
    showSpoilers ? null : (stored?.playId ?? null),
    delayMs,
  );
  // Pressing play is watching: the screen stays on until it pauses or ends.
  useWakeLock(replay.running);
  const seenThrough = useKeepWatchProgress(
    gameId,
    plays,
    stored,
    showSpoilers ? null : replay.revealedId,
    !ongoing,
  );
  const limit = showSpoilers ? undefined : seenThrough;

  // The row stands at the play on the field, or with spoilers hidden, where
  // the viewer left off.
  const atPlace = plays.find((play) => play.id === limit) ?? null;
  const shownPlay = replay.play ?? atPlace;
  const shownThrough = replay.play ? replay.revealedId : (atPlace?.id ?? null);
  const watched =
    game && drives && shownPlay
      ? figuresAt(
          game,
          drives,
          shownPlay,
          shownThrough,
          !ongoing && shownThrough === plays.at(-1)?.id,
        )
      : null;

  if (!game) {
    return (
      <section>
        <p className="text-ink-muted text-sm">
          No games on the calendar for this season.
        </p>
      </section>
    );
  }

  // Before the clock's first tick: the panel's room, and nothing in it yet.
  if (now === null) return <section aria-busy className="min-h-32" />;

  const phase = broadcastPhase(gamePhase(game, now), broadcastClock);
  const { gameId: selectedId } = game;
  // Plays not yet asked for: the first move to watch asks, then starts.
  const loadThen = (atEnd: boolean) =>
    onLoadPlays
      ? () =>
          void onLoadPlays().then((loaded) => {
            if (loaded?.gameId === selectedId) {
              replay.start(loaded.drives, atEnd);
            }
          })
      : undefined;
  const loadPlays = drives === null ? loadThen(false) : undefined;
  const shownDrives = drives ?? (loadPlays ? [] : null);
  const onReveal = showSpoilers
    ? undefined
    : phase === "final"
      ? () => {
          // Seen to the end: the row stands at the final, not at the play.
          finishGame(selectedId);
          replay.clear();
        }
      : phase === "live" && plays.length > 0
        ? replay.follow
        : phase === "live" && drives === null
          ? loadThen(true)
          : undefined;

  if (phase === "postponed" || phase === "canceled") {
    return (
      <Panel>
        <Eyebrow {...expand}>
          <span className="label-eyebrow">{weekLabel(game)}</span>
          <span className="text-loss text-xs font-semibold capitalize">
            {phase}
          </span>
        </Eyebrow>
        <Matchup
          game={game}
          team={team}
          opponentRecord={records?.opponent ?? null}
        />
        <div className="border-edge mt-4 border-t pt-3">
          <Meta game={game} />
        </div>
      </Panel>
    );
  }

  if (phase === "live") {
    const matchesLiveScore = score?.gameId === game.gameId;
    const activeScore = matchesLiveScore ? score : null;
    // The game's own clock, as of the viewer's broadcast.
    const gameClock = broadcastClock ?? activeScore;
    const teamScore = activeScore?.team.score ?? null;
    const opponentScore = activeScore?.opponent.score ?? null;
    // The scoreboard calls a game over before the stored season catches up.
    const standing = sideStanding(
      showSpoilers ? teamScore : null,
      showSpoilers ? opponentScore : null,
      gameClock?.completed === true,
    );
    const situation = showSpoilers ? (activeScore?.situation ?? null) : null;
    const followed = {
      record: records && formatRecord(records.team),
      ...standing.followed,
      display: maskedScore(teamScore, showSpoilers),
      hasBall: situation?.possession === "team",
      timeouts: situation?.timeouts.team ?? null,
    };
    const opposing = {
      record: records && formatRecord(records.opponent),
      ...standing.opposing,
      display: maskedScore(opponentScore, showSpoilers),
      hasBall: situation?.possession === "opponent",
      timeouts: situation?.timeouts.opponent ?? null,
    };
    const updatedMs =
      activeScore && scoreUpdatedAt !== null ? scoreUpdatedAt : Number.NaN;

    // From md up the play feed scrolls; the panel scrolls only as a fallback.
    return (
      <Panel className="md:flex md:min-h-0 md:flex-col md:overflow-y-auto md:overscroll-contain">
        <Eyebrow {...expand}>
          <LiveLabel
            game={game}
            // The row stands at a play; the game itself is here.
            clock={
              watched && gameClock
                ? spoilerSafeClock(gameClock, showSpoilers)
                : null
            }
            onFollow={onReveal}
          />
          {!Number.isNaN(updatedMs) && (
            <span className="text-ink-faint flex items-center gap-1 font-mono text-xs whitespace-nowrap">
              <span className="hidden sm:inline">Updated</span>
              {formatAge(now - updatedMs)}
            </span>
          )}
        </Eyebrow>

        <ScoreRow
          game={game}
          team={team}
          followed={{ ...followed, ...watched?.followed }}
          opposing={{ ...opposing, ...watched?.opposing }}
          status={
            <span className="text-ink">
              {watched?.status ??
                (gameClock
                  ? spoilerSafeClock(gameClock, showSpoilers)
                  : "In progress")}
            </span>
          }
          onReveal={onReveal}
          periods={
            watched?.periods ??
            (showSpoilers && activeScore
              ? {
                  followed: activeScore.team.periods,
                  opposing: activeScore.opponent.periods,
                }
              : null)
          }
        />

        {shownDrives ? (
          <GamePlays
            drives={shownDrives}
            {...sides(game, team)}
            replay={replay}
            ongoing
            situation={situation}
            delay={{
              seconds: delayMs / 1000,
              onCycle: () => cycleBroadcastDelay(selectedId),
            }}
            seenThrough={limit}
            onLoadPlays={loadPlays}
          />
        ) : (
          situation && (
            <Situation situation={situation} game={game} team={team} />
          )
        )}

        {scoreError && showSpoilers && (
          <p className="text-ink-faint mt-2 text-xs">
            Score may be stale: {scoreError}
          </p>
        )}

        {!expanded && (
          <div className="border-edge mt-4 border-t pt-3">
            <Meta game={game} />
          </div>
        )}
      </Panel>
    );
  }

  if (phase === "final") {
    const result = game.result;
    const standing = sideStanding(
      showSpoilers ? (result?.teamScore ?? null) : null,
      showSpoilers ? (result?.opponentScore ?? null) : null,
      true,
    );

    // As the live panel: from md up the play feed scrolls.
    return (
      <Panel className="md:flex md:min-h-0 md:flex-col md:overflow-y-auto md:overscroll-contain">
        <Eyebrow {...expand} recap={findRecap(recaps, game.gameId)}>
          {/* Covered or stood at a play, the game itself is over. */}
          {watched || onReveal ? (
            <FinalLabel game={game} onFinish={onReveal} />
          ) : (
            <span className="label-eyebrow">{weekLabel(game)}</span>
          )}
        </Eyebrow>

        <div className="mb-4">
          <ScoreRow
            game={game}
            team={team}
            followed={{
              record: records && formatRecord(records.team),
              ...standing.followed,
              display: maskedScore(result?.teamScore ?? null, showSpoilers),
              ...watched?.followed,
            }}
            opposing={{
              record: records && formatRecord(records.opponent),
              ...standing.opposing,
              display: maskedScore(result?.opponentScore ?? null, showSpoilers),
              ...watched?.opposing,
            }}
            status={
              watched ? (
                <span className="text-ink">{watched.status}</span>
              ) : (
                <span className="text-ink-muted">Final</span>
              )
            }
            onReveal={onReveal}
            periods={
              watched?.periods ??
              (showSpoilers && game.periods
                ? {
                    followed: game.periods.team,
                    opposing: game.periods.opponent,
                  }
                : null)
            }
          />
        </div>

        {shownDrives && (
          <GamePlays
            drives={shownDrives}
            {...sides(game, team)}
            replay={replay}
            ongoing={false}
            seenThrough={limit}
            onLoadPlays={loadPlays}
          />
        )}

        {!expanded && (
          <div className="border-edge mt-4 border-t pt-3">
            <Meta game={game} />
          </div>
        )}
      </Panel>
    );
  }

  // Upcoming and pregame: when and where only.
  const countdown = formatCountdown(Date.parse(game.kickoff) - now);
  const isPregame = phase === "pregame";

  return (
    <Panel>
      <Eyebrow {...expand}>
        <span className="label-eyebrow">
          {isPregame ? "Kickoff soon" : weekLabel(game)}
        </span>
        {countdown && (
          <span
            className={cn(
              "font-mono text-xs",
              isPregame ? "text-gold" : "text-ink-muted",
            )}
          >
            in {countdown}
          </span>
        )}
      </Eyebrow>

      <Matchup
        game={game}
        team={team}
        opponentRecord={records?.opponent ?? null}
      />

      <div className="border-edge mt-4 border-t pt-3">
        <Meta game={game} leading />
      </div>
    </Panel>
  );
}
