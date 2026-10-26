"use client";

import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import { FieldView, fieldToFill } from "~/components/game/FieldView";
import { PlayFeed, playTime } from "~/components/game/PlayFeed";
import { useBoxSize } from "~/hooks/useBoxSize";
import { type ReplayControls } from "~/hooks/useReplay";
import { nextBroadcastDelay } from "~/lib/broadcast-delay";
import {
  currentSet,
  drivesThrough,
  fieldAfterPlay,
  fieldAtPlay,
  withDriveSpots,
  type PlayOnField,
} from "~/lib/plays";
import { type Drive, type Play as GamePlay } from "~/lib/plays.schema";
import { type SituationState } from "~/lib/score.schema";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

const CONTROL =
  "text-ink-faint hover:text-ink-muted -my-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md py-2 text-xs whitespace-nowrap transition-colors";

/** The leading watch action: unframed, a shade brighter than the rest. */
const PRIMARY =
  "text-ink-muted hover:text-ink -my-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md py-2 text-xs font-semibold whitespace-nowrap transition-colors";

const TRANSPORT =
  "text-ink-muted hover:text-ink hover:bg-surface-raised inline-flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors select-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

function Caption({
  play,
  situation,
}: {
  play: GamePlay | null;
  situation: SituationState | null;
}) {
  if (play) {
    const label =
      play.downDistance ?? (play.kind === "stoppage" ? play.headline : null);
    return (
      <p className="flex min-w-0 items-baseline gap-2">
        {label && (
          <span className="text-ink truncate text-sm font-semibold tabular-nums">
            {label}
          </span>
        )}
        <span className="text-ink-faint font-mono text-xs tabular-nums">
          {playTime(play)}
        </span>
      </p>
    );
  }
  if (situation) {
    return (
      <p className="flex items-center gap-2">
        {situation.downDistance && (
          <span className="text-ink text-sm font-semibold tabular-nums">
            {situation.downDistance}
          </span>
        )}
        {situation.isRedZone && (
          <span className="text-live label-eyebrow">Red zone</span>
        )}
      </p>
    );
  }
  // Placeholder keeps the controls right-aligned.
  return <span aria-hidden />;
}

/** The live action's mark: the pulsing dot of the panel's Live label. */
function LiveDot() {
  return (
    <span
      aria-hidden
      className="bg-live animate-pulse-dot size-1.5 shrink-0 rounded-full"
    />
  );
}

/** How far a live game is held back, to match a broadcast. */
interface BroadcastDelay {
  seconds: number;
  onCycle: () => void;
}

/**
 * A drive back or on, a step back or on, play or pause, and speed. Paused,
 * the frame stays on the field to browse from. Caught up with a live game
 * there is no speed to choose; the same place holds the delay instead.
 * Behind a live game, or paused short of its newest play, a way to the
 * live action.
 */
function Transport({
  replay,
  delay,
  over,
  onWatchLive,
}: {
  replay: ReplayControls;
  delay?: BroadcastDelay;
  /** The game is over, so playing from its end starts it again. */
  over: boolean;
  onWatchLive?: () => void;
}) {
  const { running, live, speed, atStart, atEnd } = replay;
  const again = over && atEnd && !running;
  return (
    <div className="-my-1 flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => replay.skip(-1)}
        disabled={atStart}
        className={TRANSPORT}
        aria-label="Back a drive"
        title="Back a drive (⇧←)"
      >
        <SkipBack className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => replay.step(-1)}
        disabled={atStart}
        className={TRANSPORT}
        aria-label="Step back"
        title="Step back (←)"
      >
        <StepBack className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={running ? replay.pause : replay.run}
        className={TRANSPORT}
        aria-label={running ? "Pause" : again ? "Watch again" : "Play"}
        title={running ? "Pause" : again ? "Watch again" : "Play"}
      >
        {running ? (
          <Pause className="size-4" aria-hidden />
        ) : again ? (
          <RotateCcw className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={() => replay.step(1)}
        disabled={atEnd}
        className={TRANSPORT}
        aria-label="Step forward"
        title="Step forward (→)"
      >
        <StepForward className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => replay.skip(1)}
        disabled={atEnd}
        className={TRANSPORT}
        aria-label="On a drive"
        title="On a drive (⇧→)"
      >
        <SkipForward className="size-4" aria-hidden />
      </button>
      {!live ? (
        <button
          type="button"
          onClick={replay.cycleSpeed}
          className={cn(TRANSPORT, "w-auto px-1.5 font-mono text-xs")}
          aria-label={`Speed ${speed}×`}
          title="Change speed"
        >
          {speed}×
        </button>
      ) : (
        delay && (
          <button
            type="button"
            onClick={delay.onCycle}
            className={cn(TRANSPORT, "w-auto px-1.5 font-mono text-xs")}
            aria-label={`Delay ${delay.seconds}s`}
            title={
              nextBroadcastDelay(delay.seconds) > 0
                ? `Add ${nextBroadcastDelay(delay.seconds)}s delay`
                : "Remove delay"
            }
          >
            +{delay.seconds}s
          </button>
        )
      )}
      {onWatchLive && !replay.live && !replay.atEdge && (
        <button
          type="button"
          onClick={onWatchLive}
          className={cn(TRANSPORT, "w-auto gap-1.5 px-1.5 text-xs")}
          aria-label="Watch live"
          title="Watch live"
        >
          <LiveDot />
          Live
        </button>
      )}
    </div>
  );
}

/**
 * Entry points into watching, with nothing on the field. With the result
 * hidden: unwatched leads with kickoff, partway with resume. A game under
 * way can be joined at its newest play, unless the viewer is already there.
 */
function WatchActions({
  replay,
  limited,
  seen,
  onLoad,
  onWatchLive,
}: {
  replay: ReplayControls;
  limited: boolean;
  seen: string | null;
  /** The plays are not here yet; pressing asks for them and starts. */
  onLoad?: () => void;
  onWatchLive?: () => void;
}) {
  const live = onWatchLive && (
    <button type="button" onClick={onWatchLive} className={CONTROL}>
      <LiveDot />
      Watch live
    </button>
  );
  if (onLoad) {
    return (
      <>
        {live}
        <button type="button" onClick={onLoad} className={PRIMARY}>
          <Play className="size-3.5" aria-hidden />
          Watch from kickoff
        </button>
      </>
    );
  }
  if (limited && seen !== null) {
    return (
      <>
        <button
          type="button"
          onClick={() => replay.resume(null)}
          className={CONTROL}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          From kickoff
        </button>
        {live}
        <button
          type="button"
          onClick={() => replay.resume(seen)}
          className={PRIMARY}
        >
          <Play className="size-3.5" aria-hidden />
          Resume
        </button>
      </>
    );
  }
  return (
    <>
      {live}
      <button
        type="button"
        onClick={() => replay.resume(null)}
        className={limited ? PRIMARY : CONTROL}
      >
        <Play className="size-3.5" aria-hidden />
        Watch from kickoff
      </button>
    </>
  );
}

/**
 * Screen-reader announcement of the play on the field: possession and down
 * while lined up, the full play once played, and the next down once it is
 * over. Mounted throughout, so a screen reader is already listening when the
 * first play is announced.
 */
function Announcement({
  play,
  offense,
  stage,
  nextDown,
}: {
  play: GamePlay | null;
  offense: Team | null;
  stage: ReplayControls["stage"];
  nextDown: string | null;
}) {
  return (
    <p aria-live="polite" className="sr-only">
      {play === null
        ? ""
        : stage === "after"
          ? (nextDown ?? "")
          : stage === "snap"
            ? [offense && `${offense.abbreviation} ball`, play.downDistance]
                .filter(Boolean)
                .join(", ")
            : play.text}
    </p>
  );
}

/**
 * The field and play-by-play as one control: picking a play puts it on the
 * field, stepping moves it a frame at a time, and playing steps on its own.
 * Paused, the frame stays on the field to browse from.
 *
 * Past a live game's newest play, the field is the game as it now stands
 * (`edge`): the ball where it was spotted, the down and line to gain, and the
 * set through that play, until the next play is known. A finished game with
 * nothing on the field waits for a pick.
 *
 * The feed reads newest first throughout; while playing it holds back each
 * play until its result is out, and with the result hidden it stands at the
 * play on the field.
 *
 * With spoilers hidden the caller passes `seenThrough`, the viewer's place;
 * the feed shows nothing past it. A game seen to the end is no longer hidden.
 */
export function GamePlays({
  drives,
  home,
  away,
  replay,
  ongoing,
  edge = null,
  seenThrough,
  delay,
  onLoadPlays,
  onWatchLive,
  sideways = false,
  head,
}: {
  drives: Drive[];
  home: Team;
  away: Team;
  replay: ReplayControls;
  /** Live: the newest play is followed by the game as it now stands. */
  ongoing: boolean;
  /**
   * The game past the newest play, or before the first: from the
   * scoreboard, or the play's own word. Null where neither says.
   */
  edge?: SituationState | null;
  /**
   * Last play seen while the result is hidden; null before anything is
   * watched. Undefined leaves the whole game open.
   */
  seenThrough?: string | null;
  /** A live game's broadcast delay, offered once caught up with it. */
  delay?: BroadcastDelay;
  /**
   * With `drives` empty because they have not been asked for: asks for
   * them and starts from kickoff when they come.
   */
  onLoadPlays?: () => void;
  /** Joins a game under way at its newest play, and follows it. */
  onWatchLive?: () => void;
  /**
   * A phone on its side: the field and its controls beside the feed, filling
   * the height the parent gives them.
   */
  sideways?: boolean;
  /** Sideways, what heads the field's column: the label and the score. */
  head?: ReactNode;
}) {
  const { play, running, stage, revealedId } = replay;
  const fieldBox = useRef<HTMLDivElement>(null);
  const box = useBoxSize(fieldBox, sideways);
  const fill = sideways && box ? fieldToFill(box.width, box.height) : null;
  const limited = seenThrough !== undefined;
  const seen = seenThrough ?? null;
  // With nothing on the field, it rests where the viewer left off.
  const resting =
    play === null && limited && seen !== null
      ? (drives.flatMap((drive) => drive.plays).find(({ id }) => id === seen) ??
        null)
      : null;
  const onField = play ?? resting;
  const newestId = drives.at(-1)?.plays.at(-1)?.id ?? null;
  // Past the newest play, the field is the game as it stands; before the
  // first, too.
  const atEdge =
    ongoing &&
    (play
      ? stage === "after"
      : onField
        ? onField.id === newestId
        : newestId === null);
  const nextField = edge?.downDistance ? edge.field : null;
  const driveOf = (playId: string | null) =>
    drives.find((drive) => drive.plays.some(({ id }) => id === playId)) ?? null;
  const offenseSide = driveOf(play?.id ?? null)?.offense;
  const offense =
    offenseSide === "home" ? home : offenseSide === "away" ? away : null;

  const shown: PlayOnField = onField
    ? atEdge
      ? fieldAfterPlay(drives, onField.id, nextField)
      : fieldAtPlay(drives, onField.id, play ? stage : "result")
    : atEdge && edge?.field
      ? {
          field: withDriveSpots(edge.field, drives),
          set: currentSet(edge.field, drives),
          kick: null,
          scoredBy: null,
          waiting: false,
        }
      : { field: null, set: [], kick: null, scoredBy: null, waiting: false };
  // A kick stands for the play on its own; the snaps before it fade back.
  const shownPlayId = shown.kick?.id ?? shown.set.at(-1)?.id ?? null;

  // Running, the feed shows what has played out. With the result hidden it
  // stands at the play on the field, so stepping back takes it back too, or
  // at the place with nothing on the field. Shown, a paused feed is whole.
  const feedThrough =
    running || (limited && play !== null)
      ? revealedId
      : limited
        ? seen
        : undefined;

  const onSelect = (playId: string) => {
    if (!running && playId === play?.id) replay.clear();
    else replay.select(playId);
  };

  const field = (
    <FieldView
      home={home}
      away={away}
      field={shown.field}
      set={shown.set}
      kick={shown.kick}
      scoredBy={shown.scoredBy}
      focusId={
        onField && !atEdge && !(play && stage === "snap") ? shownPlayId : null
      }
      drawFocus={stage === "result" && play !== null && shownPlayId === play.id}
      linedUp={shown.waiting}
      height={fill?.height}
    />
  );

  // A phone gets the caption over the controls, every play alike, so they
  // never jump rows as the caption's length changes; sideways, a narrow
  // column does.
  const controls = (
    <>
      <Announcement
        play={play}
        offense={offense}
        stage={stage}
        nextDown={edge?.downDistance ?? null}
      />
      <div
        className={cn(
          "flex min-h-7 flex-col gap-y-1",
          sideways
            ? "@md:flex-row @md:items-center @md:justify-between @md:gap-x-3"
            : "sm:flex-row sm:items-center sm:justify-between sm:gap-x-3",
        )}
      >
        <Caption
          play={atEdge && edge?.downDistance ? null : onField}
          situation={atEdge ? edge : null}
        />
        <div
          className={cn(
            "flex items-center gap-4 self-end",
            sideways ? "@md:self-auto" : "sm:self-auto",
          )}
        >
          {play !== null || running ? (
            <Transport
              replay={replay}
              delay={delay}
              over={!ongoing}
              onWatchLive={onWatchLive}
            />
          ) : (
            <WatchActions
              replay={replay}
              limited={limited}
              seen={seen}
              onLoad={onLoadPlays}
              // At the newest play already, Resume is watching live.
              onWatchLive={resting?.id === newestId ? undefined : onWatchLive}
            />
          )}
        </div>
      </div>
    </>
  );

  const feedDrives =
    feedThrough === undefined
      ? drives
      : feedThrough === null
        ? []
        : drivesThrough(drives, feedThrough);
  const feed = (
    <PlayFeed
      drives={feedDrives}
      home={home}
      away={away}
      ongoing={ongoing}
      selectedId={play ? revealedId : (resting?.id ?? null)}
      onSelect={onSelect}
      bounded={sideways}
    />
  );

  if (sideways) {
    // The score heads the field's column, so it reads with the field and
    // not the feed, which runs the height beside them. The field fills what
    // the column leaves it; with nothing in the feed, it has the width.
    return (
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="@container flex min-w-0 flex-1 flex-col gap-2">
          {head}
          <div
            ref={fieldBox}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
          >
            <div
              className="w-full"
              style={fill ? { width: fill.width } : undefined}
            >
              {field}
            </div>
          </div>
          {controls}
        </div>
        {feedDrives.length > 0 && (
          <div className="border-edge flex w-2/5 max-w-80 shrink-0 flex-col border-l pl-3">
            {feed}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Below md the page scrolls, not the feed: the field and its
          controls stay put so a replay can be followed from anywhere in it. */}
      <div className="bg-surface mt-4 space-y-2 max-md:sticky max-md:top-[env(safe-area-inset-top)] max-md:z-10 max-md:-mx-2 max-md:px-2 max-md:pb-2">
        {field}
        {controls}
      </div>
      {feed}
    </>
  );
}
