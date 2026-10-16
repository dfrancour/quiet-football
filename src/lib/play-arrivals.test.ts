// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  lastArrivedBy,
  notePlayArrivals,
  playArrivedAt,
} from "~/lib/play-arrivals";
import { extractPlayByPlay, playsInOrder } from "~/lib/plays";
import { SHORT_GAME } from "~/lib/test-utils/espn-summaries";

const drives = extractPlayByPlay(SHORT_GAME);
const plays = playsInOrder(drives);

describe("play arrivals", () => {
  it("counts a game's first load as always there, and later plays from when they came", () => {
    const first = drives.find((drive) =>
      drive.plays.some((play) => play.id === plays[0]!.id),
    );
    if (!first) throw new Error("The fixture has drives");
    notePlayArrivals("g", [first], 1_000);
    notePlayArrivals("g", drives, 5_000);

    expect(playArrivedAt(first.plays[0]!.id)).toBe(0);
    expect(playArrivedAt(plays.at(-1)!.id)).toBe(5_000);
    expect(lastArrivedBy(plays, 4_999)).toBe(first.plays.at(-1)!.id);
    expect(lastArrivedBy(plays, 5_000)).toBe(plays.at(-1)!.id);
  });
});
