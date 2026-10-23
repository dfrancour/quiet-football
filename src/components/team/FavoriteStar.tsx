"use client";

import { Star } from "lucide-react";
import { useFavorites } from "~/hooks/useFavorites";
import { setFavorite } from "~/lib/favorite";
import { cn } from "~/lib/utils";

/** Stars the team among the viewer's favorites, or lets it go. */
export function FavoriteStar({ abbreviation }: { abbreviation: string }) {
  const favorite = useFavorites().includes(abbreviation.toUpperCase());
  return (
    <button
      type="button"
      aria-label="Favorite team"
      aria-pressed={favorite}
      onClick={() => setFavorite(abbreviation, !favorite)}
      className={cn(
        "-m-2 shrink-0 cursor-pointer rounded-md p-2 transition-colors",
        favorite ? "text-ink-muted" : "text-ink-faint/60 hover:text-ink-muted",
      )}
    >
      <Star
        className="size-4"
        fill={favorite ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
