import { type MetadataRoute } from "next";
import { SITE_URL } from "~/lib/site";

// Under `output: "export"` a metadata route must say it is static.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
