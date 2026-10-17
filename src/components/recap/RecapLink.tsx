import { Youtube } from "lucide-react";
import { youtubeWatchUrl, type Recap } from "~/lib/recaps";

/**
 * A finished game's recap on YouTube (the NFL blocks embeds), as one icon in
 * the panel's top row, drawn like the full-screen control beside it. No
 * thumbnail or title: either can give the result away. Rendered only once
 * the dataset has linked one; there is no search fallback.
 *
 * The icon is two strokes, the frame then the play sign; hovered, the frame
 * takes YouTube's red and the sign goes white. Its artwork sits inside its
 * box where the full-screen arrows reach the corners, so it is drawn a step
 * larger, with less padding, to read the same size in the same hit area.
 */
export function RecapLink({ recap }: { recap: Recap }) {
  return (
    <a
      href={youtubeWatchUrl(recap.youtubeId)}
      target="_blank"
      rel="noreferrer noopener"
      className="text-ink-faint hover:[&>svg>path:first-child]:stroke-youtube hover:[&>svg>path:last-child]:stroke-ink -m-2 shrink-0 rounded-md p-1.5 transition-colors [&>svg>path]:transition-colors"
      aria-label="Watch recap on YouTube"
      title="Watch recap"
    >
      <Youtube className="size-5" aria-hidden />
    </a>
  );
}
