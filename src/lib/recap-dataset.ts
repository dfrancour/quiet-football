import { z } from "zod";
import { type Recap } from "~/lib/recaps";
import { type SeasonFile } from "~/lib/season.schema";
import { teamByAbbreviation } from "~/lib/teams";
import { type TeamRegistry } from "~/lib/teams.schema";
import { fetchUpstream } from "~/lib/upstream";

/** Where football-recaps-data's `nfl/` folder is served from. */
const RECAP_DATASET_URL =
  "https://raw.githubusercontent.com/dfrancour/quiet-football-recap-data/main/nfl";

export const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

/**
 * A season file from football-recaps-data, read loosely: only the fields the
 * app uses, so a field the dataset adds never breaks the read.
 */
export const recapDatasetSchema = z.object({
  season: z.number(),
  games: z.array(
    z.object({
      season_type: z.string(),
      week: z.number(),
      away: z.string(),
      home: z.string(),
      status: z.string(),
      video: z
        .object({ youtube_id: youtubeIdSchema, published_at: z.string() })
        .optional(),
    }),
  ),
});

export type RecapDataset = z.infer<typeof recapDatasetSchema>;

/** A season's file from the dataset; throws on one that is not a season file. */
export async function fetchRecapDataset(
  season: number,
  signal?: AbortSignal,
): Promise<RecapDataset> {
  return recapDatasetSchema.parse(
    await fetchUpstream(`${RECAP_DATASET_URL}/${season}.json`, signal),
  );
}

/**
 * The dataset's recaps, keyed by the game each belongs to: the one in the
 * same week between the same two teams, whichever is home, since sources can
 * disagree about a neutral site. The dataset numbers the postseason as the
 * app does, so a playoff game joins the same way. Preseason games, which the
 * app does not hold, are skipped, as is anything it cannot place.
 */
export function recapsFromDataset(
  dataset: RecapDataset,
  season: SeasonFile,
  registry: TeamRegistry,
): Record<string, Recap> {
  const recaps: Record<string, Recap> = {};
  if (dataset.season !== season.season) return recaps;

  for (const entry of dataset.games) {
    if (entry.season_type === "preseason") continue;
    if (entry.status !== "found" || !entry.video) continue;

    const away = teamByAbbreviation(registry, entry.away)?.teamId;
    const home = teamByAbbreviation(registry, entry.home)?.teamId;
    if (!away || !home) continue;
    const pair = [away, home].sort().join();
    const game = season.games.find(
      (stored) =>
        stored.week === entry.week &&
        [stored.away.teamId, stored.home.teamId].sort().join() === pair,
    );
    if (!game) continue;

    recaps[game.gameId] = {
      youtubeId: entry.video.youtube_id,
      publishedAt: entry.video.published_at,
    };
  }
  return recaps;
}
