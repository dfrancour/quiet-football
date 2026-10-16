import { describe, expect, it } from "vitest";
import { youtubeIdSchema } from "~/lib/recap-dataset";
import { findRecap, youtubeWatchUrl } from "~/lib/recaps";
import { makeRecaps } from "~/lib/test-utils/fixtures";

const VIDEO_ID = "abcDEF12_-3";

describe("youtubeIdSchema", () => {
  it("accepts an 11-character url-safe id", () => {
    expect(youtubeIdSchema.parse(VIDEO_ID)).toBe(VIDEO_ID);
  });

  it("rejects ids of the wrong length", () => {
    expect(() => youtubeIdSchema.parse("short")).toThrow();
    expect(() => youtubeIdSchema.parse(`${VIDEO_ID}extra`)).toThrow();
  });

  it("rejects an id with url-unsafe characters", () => {
    expect(() => youtubeIdSchema.parse("abcdefg/=12")).toThrow();
  });
});

describe("findRecap", () => {
  const file = makeRecaps({
    "401872974": {
      youtubeId: VIDEO_ID,
      publishedAt: "2026-10-11T00:00:00.000Z",
    },
  });

  it("finds a recap by game id", () => {
    expect(findRecap(file, "401872974")?.youtubeId).toBe(VIDEO_ID);
  });

  it("returns null for a game with nothing linked", () => {
    expect(findRecap(file, "nope")).toBeNull();
  });
});

describe("youtube urls", () => {
  it("builds a watch url", () => {
    expect(youtubeWatchUrl(VIDEO_ID)).toBe(
      `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    );
  });
});
