import { type MetadataRoute } from "next";
import { teamPath } from "~/lib/routes";
import { SITE_URL } from "~/lib/site";
import { TEAM_ABBREVIATIONS } from "~/lib/teams";

// Under `output: "export"` a metadata route must say it is static.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...TEAM_ABBREVIATIONS.map((abbr) => ({
      url: `${SITE_URL}${teamPath(abbr)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
