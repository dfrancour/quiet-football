import { type Metadata } from "next";
import { HomeApp } from "~/components/HomeApp";
import { Supported } from "~/components/common/LoadState";
import { homeMetadata } from "~/lib/metadata";

export const metadata: Metadata = homeMetadata();

/** The league: the week's games and the standings. */
export default function HomePage() {
  return (
    <Supported>
      <HomeApp />
    </Supported>
  );
}
