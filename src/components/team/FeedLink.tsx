import { Rss } from "lucide-react";
import { HeaderControl } from "~/components/common/HeaderControl";
import { teamFeedUrl } from "~/lib/routes";

/** The team's Atom feed of game recaps, for a feed reader. */
export function FeedLink({ abbreviation }: { abbreviation: string }) {
  return (
    <HeaderControl
      label="Recaps feed"
      icon={Rss}
      href={teamFeedUrl(abbreviation)}
      type="application/atom+xml"
      newTab
    />
  );
}
