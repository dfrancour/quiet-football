export const scoreConfig = {
  /** How often a week with a game under way is fetched again. */
  livePollMs: 30_000,
  /**
   * How long a live game's play-by-play may go unread. It is read as the
   * scoreboard shows a new play; this catches a play the scoreboard missed.
   */
  summaryFallbackMs: 2 * 60_000,
  /** How many times a failing poll's interval doubles before it stops growing. */
  pollBackoffDoublings: 4,
  /**
   * How long a week with games still to kick off is trusted before being
   * fetched again, to pick up flexed games and late times.
   */
  aheadStaleMs: 6 * 60 * 60_000,
  /**
   * How long a saved team registry is trusted. A season does not change its
   * teams, but a mark or color may be redrawn.
   */
  teamsStaleMs: 7 * 24 * 60 * 60_000,
  /** How long ESPN's standings, read for playoff seeds and clinch codes, are trusted. */
  marksStaleMs: 30 * 60_000,
  /**
   * How often a final game still without a recap re-reads the season's
   * recaps, by hours since the game went final: the NFL posts a recap soon
   * after and the dataset is updated often, so it is asked for every few
   * minutes at first (GitHub caches the file for five), then less and
   * less, and not at all once the window has passed.
   */
  recapsPoll: [
    { untilHours: 6, everyMs: 5 * 60_000 },
    { untilHours: 24, everyMs: 30 * 60_000 },
    { untilHours: 72, everyMs: 2 * 60 * 60_000 },
  ],
  /**
   * How long after kickoff a game is taken to have ended, for one already
   * over when first seen: the scoreboard says final, not when.
   */
  typicalGameMs: 3 * 60 * 60_000 + 15 * 60_000,
  /** How long a game's play-by-play is kept after the panel leaves it. */
  summaryKeepMs: 60 * 60_000,
} as const;
