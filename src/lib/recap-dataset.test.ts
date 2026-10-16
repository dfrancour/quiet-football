// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  recapDatasetSchema,
  recapsFromDataset,
  type RecapDataset,
} from "~/lib/recap-dataset";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

type Entry = RecapDataset["games"][number];

/** A dataset game as the season file writes it, trimmed to what is read. */
function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    season_type: "regular",
    week: 5,
    away: "MIN",
    home: "NO",
    status: "found",
    video: { youtube_id: "GP9zR_SKRr0", published_at: "2026-10-11T20:41:07Z" },
    ...overrides,
  };
}

const minAtNo = makeSeasonGame({ gameId: "min-no", status: "final" });
const wildCard = makeSeasonGame({
  gameId: "pit-mia",
  week: 19,
  home: { teamId: TEAMS.MIA.teamId, score: 20 },
  away: { teamId: TEAMS.PIT.teamId, score: 17 },
  status: "final",
});
const season = makeSeason([minAtNo, wildCard]);

const join = (...games: Entry[]) =>
  recapsFromDataset({ season: 2026, games }, season, REGISTRY);

describe("recapDatasetSchema", () => {
  it("reads a season file, ignoring fields it does not use", () => {
    const parsed = recapDatasetSchema.parse({
      $schema: "./schema.json",
      schema_version: 1,
      season: 2026,
      games: [
        {
          ...entry(),
          season: 2026,
          external_ids: { espn: "401872987" },
          kickoff: "2026-10-11T17:00:00Z",
          video: {
            youtube_id: "GP9zR_SKRr0",
            title: "Minnesota Vikings vs. New Orleans Saints Game Highlights",
            published_at: "2026-10-11T20:41:07Z",
          },
          a_field_added_later: true,
        },
        { ...entry({ status: "unknown" }), video: undefined },
      ],
    });
    expect(parsed.games).toHaveLength(2);
  });

  it("rejects a file that is not a season file", () => {
    expect(recapDatasetSchema.safeParse({ games: "nope" }).success).toBe(false);
  });
});

describe("recapsFromDataset", () => {
  it("keys each found recap by the stored game it belongs to", () => {
    expect(join(entry())).toEqual({
      "min-no": {
        youtubeId: "GP9zR_SKRr0",
        publishedAt: "2026-10-11T20:41:07Z",
      },
    });
  });

  it("joins a playoff game by the week the store gives it", () => {
    expect(
      Object.keys(
        join(
          entry({
            season_type: "postseason",
            week: 19,
            away: "PIT",
            home: "MIA",
          }),
        ),
      ),
    ).toEqual(["pit-mia"]);
  });

  it("finds a game whichever team the dataset calls home", () => {
    expect(Object.keys(join(entry({ away: "NO", home: "MIN" })))).toEqual([
      "min-no",
    ]);
  });

  it("skips a game whose opponent disagrees with the store", () => {
    expect(join(entry({ away: "MIN", home: "DET" }))).toEqual({});
  });

  it("skips games without a recap, preseason games, and games it cannot place", () => {
    expect(
      join(
        entry({ status: "unknown", video: undefined }),
        entry({ status: "searching", video: undefined }),
        entry({ season_type: "preseason", week: 2 }),
        entry({ week: 9 }),
        entry({ away: "XXX", home: "YYY" }),
      ),
    ).toEqual({});
  });

  it("returns nothing for another season's file", () => {
    expect(
      recapsFromDataset({ season: 2025, games: [entry()] }, season, REGISTRY),
    ).toEqual({});
  });
});
