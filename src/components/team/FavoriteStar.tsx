"use client";

import { Star } from "lucide-react";
import { useFavorite } from "~/hooks/useFavorite";
import { setFavorite } from "~/lib/favorite";
import { cn } from "~/lib/utils";

/** Toggles the viewer's single favorite team. */
export function FavoriteStar({ abbreviation }: { abbreviation: string }) {
  const favorite = useFavorite() === abbreviation.toUpperCase();
  return (
    <button
      type="button"
      aria-label="Favorite team"
      aria-pressed={favorite}
      onClick={() => setFavorite(favorite ? null : abbreviation)}
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
