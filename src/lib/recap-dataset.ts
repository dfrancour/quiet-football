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

/** One game of a season file, as far as the app reads it. */
const entrySchema = z.object({
  season_type: z.string(),
  week: z.number(),
  away: z.string(),
  home: z.string(),
  status: z.string(),
  video: z.object({ youtube_id: youtubeIdSchema }).optional(),
});

const seasonFileSchema = z.object({
  season: z.number(),
  games: z.array(z.unknown()),
});

export type RecapEntry = z.infer<typeof entrySchema>;

export interface RecapDataset {
  season: number;
  games: RecapEntry[];
}

/**
 * A season file from football-recaps-data, read loosely: only the fields the
 * app uses, so a field the dataset adds never breaks the read, and a game it
 * cannot read is skipped rather than costing every other its recap. Throws
 * on a file that is not a season file.
 */
export function readRecapDataset(raw: unknown): RecapDataset {
  const file = seasonFileSchema.parse(raw);
  return {
    season: file.season,
    games: file.games.flatMap((game) => {
      const entry = entrySchema.safeParse(game);
      return entry.success ? [entry.data] : [];
    }),
  };
}

/** A season's file from the dataset. */
export async function fetchRecapDataset(
  season: number,
  signal?: AbortSignal,
): Promise<RecapDataset> {
  return readRecapDataset(
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

  const meeting = (week: number, teamIds: string[]) =>
    `${week}:${teamIds.sort().join()}`;
  const games = new Map(
    season.games.map((game) => [
      meeting(game.week, [game.away.teamId, game.home.teamId]),
      game.gameId,
    ]),
  );

  for (const entry of dataset.games) {
    if (entry.season_type === "preseason") continue;
    if (entry.status !== "found" || !entry.video) continue;

    const away = teamByAbbreviation(registry, entry.away)?.teamId;
    const home = teamByAbbreviation(registry, entry.home)?.teamId;
    if (!away || !home) continue;
    const gameId = games.get(meeting(entry.week, [away, home]));
    if (gameId) recaps[gameId] = { youtubeId: entry.video.youtube_id };
  }
  return recaps;
}
