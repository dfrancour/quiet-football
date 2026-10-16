import { ExternalLink, Youtube } from "lucide-react";
import { youtubeSearchUrl, youtubeWatchUrl, type Recap } from "~/lib/recaps";
import { type TeamGame } from "~/lib/team-view";
import { type Team } from "~/lib/teams.schema";

interface RecapLinkProps {
  recap: Recap | null;
  game: TeamGame;
  team: Team;
  season: number;
}

const CONTROL =
  "text-ink-faint hover:text-ink-muted inline-flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap transition-colors";

/**
 * A link out to a finished game's recap on YouTube (the NFL blocks embeds),
 * or a YouTube search for it until one is linked. No thumbnail or title:
 * either can give the result away.
 */
export function RecapLink({ recap, game, team, season }: RecapLinkProps) {
  return (
    <a
      href={
        recap
          ? youtubeWatchUrl(recap.youtubeId)
          : youtubeSearchUrl(game, team, season)
      }
      target="_blank"
      rel="noreferrer noopener"
      className={CONTROL}
    >
      <Youtube className="size-3.5 shrink-0" aria-hidden />
      {recap ? "Watch recap" : "Search YouTube"}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
