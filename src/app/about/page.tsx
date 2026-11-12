import { type Metadata } from "next";
import { About } from "~/components/layout/About";
import { aboutMetadata } from "~/lib/metadata";

export const metadata: Metadata = aboutMetadata();

/** What the site is and where its source lives. */
export default function AboutPage() {
  return <About />;
}
