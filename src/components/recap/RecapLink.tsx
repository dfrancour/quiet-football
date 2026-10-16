import { Youtube } from "lucide-react";
import { youtubeWatchUrl, type Recap } from "~/lib/recaps";

/**
 * A finished game's recap on YouTube (the NFL blocks embeds), as one icon in
 * the panel's top row, drawn like the full-screen control beside it. No
 * thumbnail or title: either can give the result away. Rendered only once
 * the dataset has linked one; there is no search fallback.
 */
export function RecapLink({ recap }: { recap: Recap }) {
  return (
    <a
      href={youtubeWatchUrl(recap.youtubeId)}
      target="_blank"
      rel="noreferrer noopener"
      className="text-ink-faint hover:text-ink -m-2 shrink-0 rounded-md p-2 transition-colors"
      aria-label="Watch recap on YouTube"
      title="Watch recap"
    >
      <Youtube className="size-4" aria-hidden />
    </a>
  );
}
