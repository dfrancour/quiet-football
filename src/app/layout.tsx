import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Providers } from "~/app/providers";
import { VercelAnalytics } from "~/components/layout/VercelAnalytics";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1420",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* Every page reads ESPN as soon as it hydrates; open the connections while the script loads. */}
        <link
          rel="preconnect"
          href="https://site.api.espn.com"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://a.espncdn.com" />
        <Providers>
          <main className="min-h-screen">{children}</main>
        </Providers>
        <VercelAnalytics />
      </body>
    </html>
  );
}
