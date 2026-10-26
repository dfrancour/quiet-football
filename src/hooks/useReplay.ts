"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getClockSnapshot, subscribeToClock } from "~/lib/clock";
import { playArrivedAt } from "~/lib/play-arrivals";
import { playsInOrder } from "~/lib/plays";
import { type Drive, type Play } from "~/lib/plays.schema";
import {
  IDLE_REPLAY,
  REPLAY_SPEEDS,
  frameIndex,
  isLive,
  replayFrame,
  replayFrames,
  skipIndex,
  type Replay,
  type ReplayAt,
  type ReplayStage,
} from "~/lib/replay";

/** A running replay's clock resolution; 1s would eat the pause at 5×. */
const REPLAY_TICK_MS = 100;

const subscribeToReplayClock = (listener: () => void) =>
  subscribeToClock(listener, REPLAY_TICK_MS);
const subscribeToNothing = () => () => {};

const isResult = (frame: ReplayAt) => frame.stage === "result";

function lastIndexOf<T>(items: readonly T[], test: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && test(item)) return index;
  }
  return -1;
}

export interface ReplayControls {
  /** The play on the field; null follows the game, or rests at the place. */
  play: Play | null;
  stage: ReplayStage;
  /**
   * The last play whose result is shown: the previous play while a snap is
   * lined up, null before kickoff's result.
   */
  revealedId: string | null;
  /** Past a live game's newest play: the game as it now stands. */
  atEdge: boolean;
  /** Advancing on its own; false once a finished game's last play is reached. */
  running: boolean;
  /** Caught up with a game under way, taking each play as it comes. */
  live: boolean;
  speed: Replay["speed"];
  atStart: boolean;
  atEnd: boolean;
  /** Puts a play's result on the field; a running replay stops on it. */
  select: (playId: string) => void;
  /** Takes the play off the field, or back to following if that is the default. */
  clear: () => void;
  /**
   * Plays on from the frame on the field, or else from the place, or from
   * kickoff. A finished game played through starts over.
   */
  run: () => void;
  /** Plays on from the play after this one, or from kickoff. */
  resume: (afterId: string | null) => void;
  /** Plays the latest play, then each new one as it comes. */
  follow: () => void;
  /**
   * Starts on drives just loaded, before a render has them: from kickoff,
   * or `atEnd`, following from the latest play.
   */
  start: (loaded: Drive[], atEnd: boolean) => void;
  /** Leaves the frame on the field. */
  pause: () => void;
  /** A snap lined up, then its result. */
  step: (delta: number) => void;
  /** To the end of the drive, or back to where it began. */
  skip: (delta: 1 | -1) => void;
  cycleSpeed: () => void;
}

/**
 * Which play the field and feed show, and the replay that steps through
 * them: running, or paused on a frame.
 *
 * State carries its game id, so another game starts fresh without an effect.
 * `ongoing` keeps a replay caught up with a live game running, and ends its
 * frames past the newest play, where it waits for the next.
 *
 * `placeId` is the viewer's place when the result is hidden: with nothing on
 * the field, a replay and the arrow keys start from it. `delayMs` holds each
 * arriving play back that long, to match a broadcast.
 *
 * `follows` starts it following the game rather than idle: a replay that
 * began before the first play and has long since caught up.
 */
export function useReplay(
  gameId: string | null,
  drives: Drive[] | null,
  ongoing: boolean,
  placeId: string | null = null,
  delayMs = 0,
  follows = false,
): ReplayControls {
  const [state, setState] = useState<Replay & { gameId: string | null }>({
    ...IDLE_REPLAY,
    gameId: null,
  });

  const plays = useMemo(() => playsInOrder(drives ?? []), [drives]);
  const arrivedAt = (playId: string) => playArrivedAt(playId) + delayMs;
  const frames = useMemo(() => replayFrames(plays, ongoing), [plays, ongoing]);
  const first = frames[0];
  const idle: Partial<Replay> =
    follows && first
      ? {
          frame: null,
          running: { from: first, since: Number.NEGATIVE_INFINITY },
        }
      : { frame: null, running: null };
  const replay: Replay =
    state.gameId === gameId ? state : { ...IDLE_REPLAY, ...idle };
  // While running, the frame is read off the clock, but only a change of
  // frame re-renders: the snapshot is the frame's index, not the time.
  const runningIndex = useSyncExternalStore(
    replay.running ? subscribeToReplayClock : subscribeToNothing,
    () =>
      frameIndex(
        frames,
        replayFrame(replay, frames, getClockSnapshot(), arrivedAt),
      ),
    () => -1,
  );
  const frame: ReplayAt | null = replay.running
    ? (frames[runningIndex] ?? replay.running.from)
    : replay.frame;
  const index = frameIndex(frames, frame);
  // With nothing on the field, stepping starts from the place: after it, at
  // a live game's newest play.
  const origin =
    index !== -1
      ? index
      : lastIndexOf(
          frames,
          (candidate) =>
            candidate.playId === placeId && candidate.stage !== "snap",
        );
  const playIndex = plays.findIndex((play) => play.id === frame?.playId);
  const play = plays[playIndex] ?? null;
  const stage = frame?.stage ?? "result";
  const atEnd = origin === frames.length - 1;
  const revealedId =
    stage === "snap" ? (plays[playIndex - 1]?.id ?? null) : (play?.id ?? null);
  const running = replay.running !== null && (ongoing || !atEnd);

  const update = (next: Partial<Replay>) =>
    setState({ ...replay, ...next, gameId });
  const from = (start: ReplayAt | undefined): Partial<Replay> =>
    start === undefined
      ? { frame: null, running: null }
      : { frame: start, running: { from: start, since: Date.now() } };
  const newest = frames[lastIndexOf(frames, isResult)];
  const after = (playId: string | null) => {
    const at =
      playId === null
        ? -1
        : frames.findIndex(
            (candidate) =>
              candidate.playId === playId && candidate.stage === "result",
          );
    return frames[at + 1] ?? frames.at(-1);
  };

  // A running replay runs on from the frame moved to; paused, it stays.
  const moveTo = (target: ReplayAt | undefined) => {
    if (target === undefined) return;
    update(running ? from(target) : { frame: target, running: null });
  };
  const step = (delta: number) => {
    moveTo(frames[Math.min(frames.length - 1, Math.max(0, origin + delta))]);
  };
  // Where a drive back or on lands, read in render so the callback is plain.
  const skipTo = {
    back: frames[skipIndex(frames, drives ?? [], origin, -1)],
    on: frames[skipIndex(frames, drives ?? [], origin, 1)],
  };
  const skip = (delta: 1 | -1) => {
    moveTo(delta === 1 ? skipTo.on : skipTo.back);
  };

  const controls: ReplayControls = {
    play,
    stage,
    revealedId,
    atEdge: frames[origin]?.stage === "after",
    running,
    live: running && ongoing && isLive(replay, frames, index, arrivedAt),
    speed: replay.speed,
    atStart: origin <= 0,
    atEnd,
    select: (id) =>
      update({ frame: { playId: id, stage: "result" }, running: null }),
    clear: () => update(idle),
    run: () =>
      update(
        from(
          atEnd && !ongoing
            ? frames[0]
            : (frame ?? (placeId === null ? frames[0] : after(placeId))),
        ),
      ),
    resume: (afterId) => update(from(after(afterId))),
    follow: () => update(from(newest)),
    start: (loaded, atEnd) => {
      const loadedFrames = replayFrames(playsInOrder(loaded), ongoing);
      update(
        from(loadedFrames[atEnd ? lastIndexOf(loadedFrames, isResult) : 0]),
      );
    },
    pause: () => update({ frame, running: null }),
    step,
    skip,
    cycleSpeed: () => {
      const speed =
        REPLAY_SPEEDS[
          (REPLAY_SPEEDS.indexOf(replay.speed) + 1) % REPLAY_SPEEDS.length
        ] ?? 1;
      // Restart the stage from here so the faster pace does not skip ahead.
      setState({
        ...replay,
        ...(running && frame !== null ? from(frame) : {}),
        speed,
        gameId,
      });
    },
  };

  // Arrow keys step as the buttons do, and with shift skip a drive, once
  // something is on the field or there is a place to step from. Other
  // chords are left to the browser.
  const hasPlay = origin !== -1;
  const onArrow = useEffectEvent((delta: 1 | -1, drive: boolean) =>
    drive ? skip(delta) : step(delta),
  );
  useEffect(() => {
    if (!hasPlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const delta =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (delta === 0) return;
      event.preventDefault();
      onArrow(delta, event.shiftKey);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPlay]);

  return controls;
}
