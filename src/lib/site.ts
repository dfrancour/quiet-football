/** The site's name and address, for metadata, the sitemap and robots. */
export const SITE_NAME = "Quiet Football";
export const SITE_URL = "https://quiet-football.com";
export const SITE_DESCRIPTION =
  "NFL schedule, standings and play-by-play with no ads, no odds and no result shown until you ask.";

/** The recap feeds' own site: a page listing every team's feed. */
export const FEEDS_SITE_URL = "https://feeds.quiet-football.com";

/** Each team's Atom feed of game recaps, by lower-cased abbreviation. */
export const FEEDS_URL = `${FEEDS_SITE_URL}/nfl`;

/** Where the source lives. */
export const REPO_URL = "https://github.com/dfrancour/quiet-football";

/** The author's site, linked under the DF avatar all of Derek's sites share. */
export const AUTHOR_URL = "https://dfrancour.dev";

/**
 * The contact address, kept in two halves so the whole never sits in the
 * markup or the bundle for an address harvester to lift. `ContactLink` joins
 * them in the browser, after hydration.
 */
export const CONTACT_USER = "contact";
export const CONTACT_HOST = "quiet-football.com";
