import { type Drive, type Play } from "~/lib/plays.schema";
import { replayTiming } from "~/lib/replay-timing";

/** A snap has two stages, lined up then result; anything else, a result. */
export type ReplayStage = "snap" | "result";

export interface ReplayAt {
  playId: string;
  stage: ReplayStage;
}

export interface ReplayFrame extends ReplayAt {
  /** Zero for a lined-up snap. */
  drawMs: number;
}

/** Speed divides the rest, never the draw time, so a play draws in full. */
export function frameMs(frame: ReplayFrame, speed: ReplaySpeed): number {
  const { lineUpMs, holdMs } = replayTiming();
  return frame.stage === "snap"
    ? lineUpMs / speed
    : frame.drawMs + holdMs / speed;
}

/** A punt or kickoff draws twice (flight, then return); a stoppage none. */
function drawMsOf(play: Play): number {
  if (play.kind === "stoppage") return 0;
  const { drawMs } = replayTiming();
  return play.action === "punt" || play.action === "kickoff"
    ? 2 * drawMs
    : drawMs;
}

export const REPLAY_SPEEDS = [1, 2, 3, 5] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/**
 * A running replay stores where and when it started rather than its current
 * frame, so the shared clock advances it and no timer writes state.
 */
export interface Replay {
  /** The frame on the field; null follows the game. */
  frame: ReplayAt | null;
  /** Advancing on its own; the feed is cut off at the frame meanwhile. */
  running: { from: ReplayAt; since: number } | null;
  speed: ReplaySpeed;
}

/**
 * Caught up with a live game: running, with every play still to come having
 * arrived since the replay started.
 */
export function isLive(
  replay: Replay,
  frames: ReplayFrame[],
  index: number,
  arrivedAt: (playId: string) => number,
): boolean {
  const { running } = replay;
  return (
    running !== null &&
    frames
      .slice(index + 1)
      .every((frame) => arrivedAt(frame.playId) > running.since)
  );
}

export const IDLE_REPLAY: Replay = {
  frame: null,
  running: null,
  speed: 1,
};

/** Every frame in order. */
export function replayFrames(plays: Play[]): ReplayFrame[] {
  return plays.flatMap((play): ReplayFrame[] =>
    play.kind === "snap" && play.start !== null
      ? [
          { playId: play.id, stage: "snap", drawMs: 0 },
          { playId: play.id, stage: "result", drawMs: drawMsOf(play) },
        ]
      : [{ playId: play.id, stage: "result", drawMs: drawMsOf(play) }],
  );
}

/**
 * Where a skip of `delta` drives lands from `origin`: forward, the result of
 * the drive's last play (or the next drive's, from there); back, the result
 * of the drive before (so the field stands as this drive began), or the
 * first frame. The game's last frame ends the last drive, however it ends.
 */
export function skipIndex(
  frames: ReplayFrame[],
  drives: Drive[],
  origin: number,
  delta: 1 | -1,
): number {
  const ends = drives
    .map((drive) => drive.plays.at(-1)?.id)
    .map((lastId) =>
      frames.findIndex(
        (frame) => frame.playId === lastId && frame.stage === "result",
      ),
    )
    .filter((index) => index !== -1);
  if (delta === 1) {
    return (
      ends.find((index) => index > origin) ?? Math.max(0, frames.length - 1)
    );
  }
  return [...ends].reverse().find((index) => index < origin) ?? 0;
}

/**
 * A play that has lost its snap stage matches on the play alone; an unknown
 * play is -1.
 */
export function frameIndex(
  frames: ReplayFrame[],
  frame: ReplayAt | null,
): number {
  if (frame === null) return -1;
  const exact = frames.findIndex(
    (candidate) =>
      candidate.playId === frame.playId && candidate.stage === frame.stage,
  );
  return exact !== -1
    ? exact
    : frames.findIndex((candidate) => candidate.playId === frame.playId);
}

/**
 * The frame at `now`. A running replay holds at the last frame, so a live
 * game's next play is picked up when it arrives: a frame starts no earlier
 * than `arrivedAt` its play, and plays out in full from there, at 1×, as
 * live is watched.
 */
export function replayFrame(
  replay: Replay,
  frames: ReplayFrame[],
  now: number | null,
  arrivedAt: (playId: string) => number = () => 0,
): ReplayAt | null {
  const { running } = replay;
  if (!running) return replay.frame;
  let index = Math.max(0, frameIndex(frames, running.from));
  let startedAt = running.since;
  for (;;) {
    const frame = frames[index];
    const next = frames[index + 1];
    if (!frame || !next || now === null) return frame ?? null;
    const speed = arrivedAt(frame.playId) > running.since ? 1 : replay.speed;
    const nextAt = Math.max(
      startedAt + frameMs(frame, speed),
      arrivedAt(next.playId),
    );
    if (now < nextAt) return frame;
    startedAt = nextAt;
    index += 1;
  }
}
