import { type Metadata } from "next";
import { About } from "~/components/layout/About";
import { aboutPath } from "~/lib/routes";
import { SITE_NAME } from "~/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `What ${SITE_NAME} is and where its source lives.`,
  alternates: { canonical: aboutPath() },
};

/** What the site is and where its source lives. */
export default function AboutPage() {
  return <About />;
}
