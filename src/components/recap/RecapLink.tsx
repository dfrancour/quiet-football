import { youtubeWatchUrl, type Recap } from "~/lib/recaps";
import { cn } from "~/lib/utils";

/**
 * Where the link sits: a game panel's top row, beside the full-screen
 * control, or a schedule row's status, beside Final.
 */
type RecapLinkSize = "panel" | "row";

const SIZES: Record<RecapLinkSize, { link: string; px: number; icon: string }> =
  {
    // The artwork sits inside its box where the full-screen arrows reach the
    // corners, so it is drawn a step larger, with less padding, to read the
    // same size in the same hit area.
    // Filled when hovered, as the full-screen control beside it is.
    panel: {
      link: "hover:bg-surface-raised -m-2 p-1.5",
      px: 20,
      icon: "size-5",
    },
    // Sized to the row's text, its hit area reaching past it without
    // making the row taller. A row pointed at is already raised, so it
    // fills as the row's team cells do.
    row: {
      link: "hover:bg-surface-sunken -my-2 inline-flex p-2",
      px: 16,
      icon: "size-4",
    },
  };

/**
 * A finished game's recap on YouTube (the NFL blocks embeds), as one icon.
 * No thumbnail or title: either can give the result away. Rendered only
 * once the dataset has linked one; there is no search fallback.
 *
 * The icon is two strokes, the frame then the play sign; hovered, the frame
 * takes YouTube's red and the sign goes white.
 */
export function RecapLink({
  recap,
  size = "panel",
}: {
  recap: Recap;
  size?: RecapLinkSize;
}) {
  const { link, px, icon } = SIZES[size];
  return (
    <a
      href={youtubeWatchUrl(recap.youtubeId)}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "text-ink-faint hover:[&>svg>path:first-child]:stroke-youtube hover:[&>svg>path:last-child]:stroke-ink shrink-0 rounded-md transition-colors [&>svg>path]:transition-colors",
        link,
      )}
      aria-label="Watch recap on YouTube"
      title="Watch recap"
    >
      <YouTubeMark px={px} className={icon} />
    </a>
  );
}

/** Lucide's YouTube icon (ISC), drawn inline as Lucide drops brand marks. */
function YouTubeMark({ px, className }: { px: number; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}
