import { type MetadataRoute } from "next";
import { ICON_GROUND, PALETTE } from "~/lib/palette";
import { SITE_DESCRIPTION, SITE_NAME } from "~/lib/site";

// Under `output: "export"` a metadata route must say it is static.
export const dynamic = "force-static";

/** The web app manifest, so the site can be installed as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: ICON_GROUND,
    theme_color: PALETTE.surface,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
