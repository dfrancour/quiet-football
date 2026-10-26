"use client";

import { Star } from "lucide-react";
import { control } from "~/components/common/control";
import { useFavorites } from "~/hooks/useFavorites";
import { setFavorite } from "~/lib/favorite";

/** Stars the team among the viewer's favorites, or lets it go. */
export function FavoriteStar({ abbreviation }: { abbreviation: string }) {
  const favorite = useFavorites().includes(abbreviation.toUpperCase());
  return (
    <button
      type="button"
      aria-label="Favorite team"
      aria-pressed={favorite}
      onClick={() => setFavorite(abbreviation, !favorite)}
      // On, it rests a step up, where hovering takes it.
      className={control({
        tone: favorite ? "muted" : "faint",
        shape: "glyph",
      })}
    >
      <Star
        className="size-4"
        fill={favorite ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}
