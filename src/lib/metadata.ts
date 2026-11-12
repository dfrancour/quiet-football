import { type Metadata } from "next";
import { aboutPath, standingsPath, teamPath } from "~/lib/routes";
import { SITE_DESCRIPTION, SITE_NAME } from "~/lib/site";
import { teamName } from "~/lib/teams";

interface PageMetadata {
  /** The whole title, as a search result or a shared link shows it. */
  title: string;
  description: string;
  path: string;
}

/**
 * A page's title, description and canonical address, and the same for a
 * link shared to it. Next replaces a layout's `openGraph` and `twitter`
 * whole rather than merging them, so every page states all of both: a page
 * that left them out would share as the home page.
 */
export function pageMetadata({
  title,
  description,
  path,
}: PageMetadata): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

/** The league page: the site's name, with what it is in the description. */
export function homeMetadata(): Metadata {
  return pageMetadata({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    path: standingsPath(),
  });
}

export function aboutMetadata(): Metadata {
  return pageMetadata({
    title: `About | ${SITE_NAME}`,
    description: `What ${SITE_NAME} is and where its source lives.`,
    path: aboutPath(),
  });
}

/** A team page, by the team's name ("Minnesota Vikings"), not its abbreviation. */
export function teamMetadata(abbreviation: string): Metadata {
  const name = teamName(abbreviation);
  return pageMetadata({
    title: `${name} | ${SITE_NAME}`,
    description: `${name} schedule, record, and play-by-play with no ads, no odds, and no result shown until you ask.`,
    path: teamPath(abbreviation),
  });
}
