import { describe, expect, it } from "vitest";
import { type Play } from "~/lib/plays.schema";
import { type Drive } from "~/lib/plays.schema";
import {
  IDLE_REPLAY,
  frameIndex,
  isLive,
  replayFrame,
  replayFrames,
  skipIndex,
  type Replay,
} from "~/lib/replay";
import { DEFAULT_TIMING } from "~/lib/replay-timing";

const {
  lineUpMs: LINE_UP_MS,
  drawMs: DRAW_MS,
  holdMs: HOLD_MS,
} = DEFAULT_TIMING;

function play(id: string, kind: Play["kind"] = "snap"): Play {
  return {
    id,
    kind,
    action: null,
    outcome: null,
    headline: "A play",
    timeoutBy: null,
    text: "A play.",
    period: 1,
    clock: "10:00",
    downDistance: null,
    down: kind === "snap" ? 1 : null,
    distance: kind === "snap" ? 10 : null,
    start: kind === "snap" ? 25 : null,
    end: null,
    nextDown: null,
    scoring: false,
    turnover: false,
    penalty: false,
    score: null,
  };
}

// A kickoff, then two snaps.
const frames = replayFrames([play("k", "kick"), play("a"), play("b")]);
const since = 1_000_000;

function running(overrides: Partial<Replay> = {}): Replay {
  return {
    ...IDLE_REPLAY,
    running: { from: { playId: "a", stage: "snap" }, since },
    ...overrides,
  };
}

const at = (replay: Replay, now: number | null) => {
  const frame = replayFrame(replay, frames, now);
  return frame && `${frame.playId}:${frame.stage}`;
};

describe("replayFrames", () => {
  it("lines a snap up before its result, and gives a kick only a result", () => {
    expect(frames.map((frame) => `${frame.playId}:${frame.stage}`)).toEqual([
      "k:result",
      "a:snap",
      "a:result",
      "b:snap",
      "b:result",
    ]);
  });

  it("ends a game under way after its newest play, to wait there", () => {
    const live = replayFrames([play("k", "kick"), play("a")], true);
    expect(live.map((frame) => `${frame.playId}:${frame.stage}`)).toEqual([
      "k:result",
      "a:snap",
      "a:result",
      "a:after",
    ]);
    expect(replayFrames([], true)).toEqual([]);
  });

  it("gives a kick that may be run back time for both its parts", () => {
    const [kickoff] = replayFrames([
      { ...play("k", "kick"), action: "kickoff" },
    ]);
    expect(kickoff?.drawMs).toBe(2 * DRAW_MS);
    expect(frames[2]?.drawMs).toBe(DRAW_MS);
  });
});

describe("replayFrame", () => {
  it("stays on the picked frame while paused", () => {
    const frame = { playId: "b", stage: "snap" } as const;
    expect(replayFrame({ ...IDLE_REPLAY, frame }, frames, since)).toBe(frame);
  });

  it("lines a snap up, then draws its result and holds it", () => {
    const played = since + LINE_UP_MS;
    expect(at(running(), since)).toBe("a:snap");
    expect(at(running(), played - 1)).toBe("a:snap");
    expect(at(running(), played)).toBe("a:result");
    expect(at(running(), played + DRAW_MS + HOLD_MS - 1)).toBe("a:result");
    expect(at(running(), played + DRAW_MS + HOLD_MS)).toBe("b:snap");
  });

  it("shortens the wait at a higher speed, never the drawing", () => {
    const fast = running({ speed: 3 });
    const played = since + LINE_UP_MS / 3;
    expect(at(fast, played)).toBe("a:result");
    // Drawn in full, then held a third as long.
    expect(at(fast, played + DRAW_MS + HOLD_MS / 3 - 1)).toBe("a:result");
    expect(at(fast, played + DRAW_MS + HOLD_MS / 3)).toBe("b:snap");
  });

  it("holds at the last frame until another arrives", () => {
    const later = since + 60_000;
    expect(at(running(), later)).toBe("b:result");
    const more = replayFrames([
      play("k", "kick"),
      play("a"),
      play("b"),
      play("c"),
    ]);
    expect(replayFrame(running(), more, later)?.playId).toBe("c");
  });

  it("plays a play out from when it arrived, not from when the wait began", () => {
    const more = replayFrames([
      play("k", "kick"),
      play("a"),
      play("b"),
      play("c"),
      play("d"),
    ]);
    // Two plays land together a minute after the replay caught up.
    const arrived = since + 60_000;
    const arrivedAt = (id: string) => (id === "c" || id === "d" ? arrived : 0);
    const frameAt = (now: number) => {
      const frame = replayFrame(running(), more, now, arrivedAt);
      return frame && `${frame.playId}:${frame.stage}`;
    };

    expect(frameAt(arrived - 1)).toBe("b:result");
    // The wait showed it lined up, so it is played at once.
    expect(frameAt(arrived)).toBe("c:result");
    // The second waits its turn behind the first, lined up as usual.
    expect(frameAt(arrived + DRAW_MS + HOLD_MS - 1)).toBe("c:result");
    expect(frameAt(arrived + DRAW_MS + HOLD_MS)).toBe("d:snap");
    expect(frameAt(arrived + DRAW_MS + HOLD_MS + LINE_UP_MS)).toBe("d:result");
  });

  it("plays what arrived after it started at 1×, as live is watched", () => {
    const more = replayFrames([play("k", "kick"), play("a"), play("b")]);
    const arrivedAt = (id: string) => (id === "b" ? since + 1 : 0);
    const fast = running({ speed: 3 });
    // "a" was there all along, so it rests a third as long; "b" in full.
    const bAt = since + LINE_UP_MS / 3 + DRAW_MS + HOLD_MS / 3;
    expect(replayFrame(fast, more, bAt, arrivedAt)?.stage).toBe("snap");
    expect(
      replayFrame(fast, more, bAt + LINE_UP_MS - 1, arrivedAt)?.stage,
    ).toBe("snap");
    expect(replayFrame(fast, more, bAt + LINE_UP_MS, arrivedAt)?.stage).toBe(
      "result",
    );
  });

  it("moves on to the game as it stands once the newest play is drawn", () => {
    const live = replayFrames([play("k", "kick"), play("a"), play("b")], true);
    const frameAt = (now: number) => {
      const frame = replayFrame(running(), live, now);
      return frame && `${frame.playId}:${frame.stage}`;
    };
    const bPlayed = since + 2 * LINE_UP_MS + DRAW_MS + HOLD_MS;
    expect(frameAt(bPlayed)).toBe("b:result");
    expect(frameAt(bPlayed + DRAW_MS + HOLD_MS)).toBe("b:after");
    expect(frameAt(bPlayed + 60_000)).toBe("b:after");
  });

  it("follows from long before, at the game as it stands", () => {
    const live = replayFrames([play("k", "kick"), play("a"), play("b")], true);
    const following: Replay = {
      ...IDLE_REPLAY,
      running: { from: { playId: "k", stage: "result" }, since: -Infinity },
    };
    expect(replayFrame(following, live, since)?.stage).toBe("after");
    // A play that lands is played at once, then waited after.
    const more = replayFrames(
      [play("k", "kick"), play("a"), play("b"), play("c")],
      true,
    );
    const arrivedAt = (id: string) => (id === "c" ? since : 0);
    const frameAt = (now: number) => {
      const frame = replayFrame(following, more, now, arrivedAt);
      return frame && `${frame.playId}:${frame.stage}`;
    };
    expect(frameAt(since - 1)).toBe("b:result");
    expect(frameAt(since)).toBe("c:result");
    expect(frameAt(since + DRAW_MS + HOLD_MS)).toBe("c:after");
  });

  it("holds still before the clock has started", () => {
    expect(at(running(), null)).toBe("a:snap");
  });
});

describe("frameIndex", () => {
  it("takes the moment after a play, once the next is known, as it lined up", () => {
    const after = { playId: "a", stage: "after" } as const;
    const live = replayFrames([play("k", "kick"), play("a")], true);
    expect(live[frameIndex(live, after)]?.stage).toBe("after");
    // "b" arrives: the moment after "a" is "b" lined up.
    expect(frameIndex(frames, after)).toBe(3);
    expect(frames[3]).toMatchObject({ playId: "b", stage: "snap" });
  });

  it("leaves it on the play when what came next is never lined up", () => {
    const withKick = replayFrames([play("a"), play("t", "kick")]);
    expect(
      withKick[frameIndex(withKick, { playId: "a", stage: "after" })],
    ).toMatchObject({ playId: "a", stage: "result" });
  });
});

describe("skipIndex", () => {
  const drive = (id: string, plays: Play[]): Drive => ({
    id,
    offense: "home",
    description: null,
    result: null,
    isScore: false,
    inProgress: false,
    plays,
  });
  // Kickoff and two snaps; then a snap and a punt; then a snap under way.
  const drives = [
    drive("d1", [play("k", "kick"), play("a"), play("b")]),
    drive("d2", [play("c"), play("p", "kick")]),
    drive("d3", [play("d")]),
  ];
  const all = replayFrames(drives.flatMap((each) => each.plays));
  const at = (index: number) => `${all[index]?.playId}:${all[index]?.stage}`;

  it("lands on the end of the drive, then the next drive's end", () => {
    expect(at(skipIndex(all, drives, 1, 1))).toBe("b:result");
    expect(at(skipIndex(all, drives, 4, 1))).toBe("p:result");
    expect(at(skipIndex(all, drives, 7, 1))).toBe("d:result");
  });

  it("goes back to where the drive began: the drive before's end", () => {
    expect(at(skipIndex(all, drives, 6, -1))).toBe("b:result");
    expect(at(skipIndex(all, drives, 4, -1))).toBe("k:result");
    expect(at(skipIndex(all, drives, 2, -1))).toBe("k:result");
    expect(skipIndex(all, drives, 0, -1)).toBe(0);
  });

  it("ends at the last frame, however the last drive ends", () => {
    expect(skipIndex(all, drives, all.length - 1, 1)).toBe(all.length - 1);
    expect(at(skipIndex(all, drives, -1, 1))).toBe("b:result");
  });
});

describe("isLive", () => {
  const arrivedLater = (id: string) => (id === "b" ? since + 1 : 0);

  it("is caught up once only plays that arrived since are left", () => {
    // On "a"'s result, with only "b", which came in since, to go.
    expect(isLive(running(), frames, 2, arrivedLater)).toBe(true);
    expect(isLive(running(), frames, frames.length - 1, () => 0)).toBe(true);
  });

  it("is behind while plays that were already there are left", () => {
    expect(isLive(running(), frames, 1, () => 0)).toBe(false);
  });

  it("is caught up on the newest play, with only the wait after it to go", () => {
    const live = replayFrames([play("k", "kick"), play("a"), play("b")], true);
    expect(isLive(running(), live, live.length - 2, () => 0)).toBe(true);
  });

  it("is never live while paused", () => {
    expect(isLive(IDLE_REPLAY, frames, frames.length - 1, () => 0)).toBe(false);
  });
});
