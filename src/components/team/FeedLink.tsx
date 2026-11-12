import { Rss } from "lucide-react";
import { control } from "~/components/common/control";
import { teamFeedUrl } from "~/lib/routes";

/** The team's Atom feed of game recaps, for a feed reader. */
export function FeedLink({ abbreviation }: { abbreviation: string }) {
  return (
    <a
      href={teamFeedUrl(abbreviation)}
      type="application/atom+xml"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Recaps feed"
      title="Recaps feed (Atom)"
      className={control({ tone: "faint", shape: "glyph" })}
    >
      <Rss className="size-4" aria-hidden />
    </a>
  );
}
