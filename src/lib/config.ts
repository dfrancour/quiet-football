export const scoreConfig = {
  /** How often a week with a game under way is fetched again. */
  livePollMs: 30_000,
  /**
   * How long a week with games still to kick off is trusted before being
   * fetched again, to pick up flexed games and late times.
   */
  aheadStaleMs: 6 * 60 * 60_000,
  /** How long ESPN's playoff seeds and clinch codes are trusted. */
  marksStaleMs: 30 * 60_000,
  /** How long a game's play-by-play is kept after the panel leaves it. */
  summaryKeepMs: 60 * 60_000,
} as const;
