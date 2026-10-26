"use client";

import { useMemo, type ComponentProps, type ReactNode } from "react";
import { FieldView } from "~/components/game/FieldView";
import {
  ScoreRow,
  figuresAt,
  sideStanding,
  sides,
  type SideFigures,
} from "~/components/game/ScoreRow";
import { GamePlays } from "~/components/game/GamePlays";
import {
  Eyebrow,
  FinalLabel,
  LiveLabel,
  type ExpandControl,
} from "~/components/game/PanelTop";
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
import { playsInOrder, situationAfterPlay } from "~/lib/plays";
import { formatDateTime } from "~/lib/dates";
import { type Drive, type PlayByPlay } from "~/lib/plays.schema";
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
   * The game as the scoreboard left it after a play, if a poll saw it
   * (`game-situations.ts`): shown past the newest play until the next.
   */
  situationAfter?: (playId: string) => SituationState | null;
  /**
   * Given while the plays have not been asked for: the viewer's first move
   * to watch asks for them. Resolves to the plays, or null if none came.
   */
  onLoadPlays?: () => Promise<PlayByPlay | null>;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /**
   * A phone on its side: a live or final game fills the panel's height,
   * the score one line over the field and its controls beside the feed.
   */
  sideways?: boolean;
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
 * A live or final game: its label over the score, its plays (or what stands
 * in for them), and when and on what. Sideways the label and score head the
 * field's column, filling the height given; from md up the feed scrolls, the
 * panel only as a fallback.
 */
function PlayedGame({
  game,
  team,
  expand,
  sideways,
  label,
  recap = null,
  score,
  drives,
  feed,
  fallback = null,
  note = null,
}: {
  game: TeamGame;
  team: Team;
  expand: ExpandControl;
  sideways: boolean;
  /** The top row's label, beside the recap and full-screen controls. */
  label: ReactNode;
  recap?: Recap | null;
  score: Omit<ComponentProps<typeof ScoreRow>, "game" | "team" | "compact">;
  /** Null when there are no plays to draw nor any to ask for. */
  drives: Drive[] | null;
  feed: Omit<
    ComponentProps<typeof GamePlays>,
    "drives" | "home" | "away" | "sideways" | "head"
  >;
  /** In place of the plays when there are none. */
  fallback?: ReactNode;
  /** A line under the plays. */
  note?: ReactNode;
}) {
  const inColumn = sideways && drives !== null;
  const head = (
    <>
      <Eyebrow {...expand} flush={inColumn} recap={recap}>
        {label}
      </Eyebrow>
      <ScoreRow game={game} team={team} compact={sideways} {...score} />
    </>
  );

  return (
    <Panel
      className={
        sideways
          ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          : "md:flex md:min-h-0 md:flex-col md:overflow-y-auto md:overscroll-contain"
      }
    >
      {!inColumn && head}
      {drives ? (
        <GamePlays
          drives={drives}
          {...sides(game, team)}
          {...feed}
          sideways={sideways}
          head={inColumn ? head : undefined}
        />
      ) : (
        fallback
      )}
      {note}
      {!expand.expanded && !sideways && (
        <div className="border-edge mt-4 border-t pt-3">
          <Meta game={game} />
        </div>
      )}
    </Panel>
  );
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
  situationAfter,
  onLoadPlays,
  expanded = false,
  onToggleExpanded,
  sideways = false,
}: GameDetailProps) {
  const expand = { expanded, onToggleExpanded };
  const gameId = game?.gameId ?? null;
  const summary =
    game && playByPlay?.gameId === game.gameId ? playByPlay : null;
  const allDrives = summary?.drives ?? null;
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
  // With the result shown, a game under way is followed from the start: the
  // newest play as it lands, and the game as it stands between plays.
  const replay = useReplay(
    gameId,
    drives,
    ongoing,
    showSpoilers ? null : (stored?.playId ?? null),
    delayMs,
    showSpoilers && ongoing,
  );
  // Watching is keeping the screen on, until it pauses or ends.
  useWakeLock(replay.running);
  const seenThrough = useKeepWatchProgress(
    gameId,
    plays,
    stored,
    showSpoilers ? null : replay.revealedId,
    // Over once the summary says so too: the scoreboard can call a game
    // before the summary has its last plays.
    !ongoing && summary?.final === true,
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

  // Past the newest play, the game as it now stands: as the scoreboard left
  // it after that play, or the play's own word on where the ball is. Before
  // the first play, the scoreboard's, once the result may be shown.
  const activeScore = score?.gameId === gameId ? score : null;
  const newest = plays.at(-1) ?? null;
  const edge =
    !game || !ongoing
      ? null
      : newest
        ? (situationAfter?.(newest.id) ??
          situationAfterPlay(drives ?? [], newest.id, game.homeAway))
        : showSpoilers
          ? (activeScore?.situation ?? null)
          : null;
  const { atEdge } = replay;

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

  /** Each side's record and score as far as the result may be shown. */
  const resultFigures = (
    teamScore: number | null,
    opponentScore: number | null,
    over: boolean,
  ) => {
    const standing = sideStanding(
      showSpoilers ? teamScore : null,
      showSpoilers ? opponentScore : null,
      over,
    );
    return {
      followed: {
        record: records && formatRecord(records.team),
        ...standing.followed,
        display: maskedScore(teamScore, showSpoilers),
      },
      opposing: {
        record: records && formatRecord(records.opponent),
        ...standing.opposing,
        display: maskedScore(opponentScore, showSpoilers),
      },
    };
  };

  if (phase === "live") {
    // The game's own clock, as of the viewer's broadcast.
    const gameClock = broadcastClock ?? activeScore;
    // The scoreboard calls a game over before the stored season catches up.
    const { followed, opposing } = resultFigures(
      activeScore?.team.score ?? null,
      activeScore?.opponent.score ?? null,
      gameClock?.completed === true,
    );
    const situation = showSpoilers ? (activeScore?.situation ?? null) : null;
    // Who has the ball and the timeouts: the scoreboard's, then the play on
    // the field's, and between plays the game's now.
    const side = (
      shown: "team" | "opponent",
      watchedSide?: Partial<SideFigures>,
    ): SideFigures => ({
      ...(shown === "team" ? followed : opposing),
      hasBall: situation?.possession === shown,
      timeouts: situation?.timeouts[shown] ?? null,
      ...watchedSide,
      ...(atEdge && edge
        ? {
            hasBall: edge.possession === shown,
            timeouts: edge.timeouts[shown] ?? watchedSide?.timeouts ?? null,
          }
        : {}),
    });
    const clockNow = gameClock
      ? spoilerSafeClock(gameClock, showSpoilers)
      : null;
    // Shown, a viewer not following can go back to it.
    const onFollow = showSpoilers
      ? plays.length > 0 && !replay.live
        ? replay.clear
        : undefined
      : onReveal;
    const updatedAt = activeScore ? scoreUpdatedAt : null;

    return (
      <PlayedGame
        game={game}
        team={team}
        expand={expand}
        sideways={sideways}
        label={
          <>
            <LiveLabel
              game={game}
              // The row stands at a play; the game itself is here.
              clock={watched && !atEdge ? clockNow : null}
              onFollow={onFollow}
            />
            {updatedAt !== null && (
              <span className="text-ink-faint flex items-center gap-1 font-mono text-xs whitespace-nowrap">
                <span className="hidden sm:inline">Updated</span>
                {formatAge(now - updatedAt)}
              </span>
            )}
          </>
        }
        score={{
          followed: side("team", watched?.followed),
          opposing: side("opponent", watched?.opposing),
          status: (
            <span className="text-ink">
              {(atEdge ? clockNow : null) ??
                watched?.status ??
                clockNow ??
                "In progress"}
            </span>
          ),
          onReveal,
          periods:
            watched?.periods ??
            (showSpoilers && activeScore
              ? {
                  followed: activeScore.team.periods,
                  opposing: activeScore.opponent.periods,
                }
              : null),
        }}
        drives={shownDrives}
        feed={{
          replay,
          ongoing: true,
          edge,
          delay: {
            seconds: delayMs / 1000,
            onCycle: () => cycleBroadcastDelay(selectedId),
          },
          seenThrough: limit,
          onLoadPlays: loadPlays,
          onWatchLive: onFollow,
        }}
        fallback={
          situation && (
            <Situation situation={situation} game={game} team={team} />
          )
        }
        note={
          scoreError &&
          showSpoilers && (
            <p className="text-ink-faint mt-2 text-xs">
              Score may be stale: {scoreError}
            </p>
          )
        }
      />
    );
  }

  if (phase === "final") {
    const { followed, opposing } = resultFigures(
      game.result?.teamScore ?? null,
      game.result?.opponentScore ?? null,
      true,
    );
    return (
      <PlayedGame
        game={game}
        team={team}
        expand={expand}
        sideways={sideways}
        label={
          // Covered or stood at a play, the game itself is over.
          watched || onReveal ? (
            <FinalLabel game={game} onFinish={onReveal} />
          ) : (
            <span className="label-eyebrow">{weekLabel(game)}</span>
          )
        }
        recap={findRecap(recaps, game.gameId)}
        score={{
          followed: { ...followed, ...watched?.followed },
          opposing: { ...opposing, ...watched?.opposing },
          status: watched ? (
            <span className="text-ink">{watched.status}</span>
          ) : (
            <span className="text-ink-muted">Final</span>
          ),
          onReveal,
          periods:
            watched?.periods ??
            (showSpoilers && game.periods
              ? { followed: game.periods.team, opposing: game.periods.opponent }
              : null),
        }}
        drives={shownDrives}
        feed={{
          replay,
          ongoing: false,
          seenThrough: limit,
          onLoadPlays: loadPlays,
        }}
      />
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
