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
      <YouTubeMark />
    </a>
  );
}

/** Lucide's YouTube icon (ISC), drawn inline as Lucide drops brand marks. */
function YouTubeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}
