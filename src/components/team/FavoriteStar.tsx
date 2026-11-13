"use client";

import { Star } from "lucide-react";
import { HeaderControl } from "~/components/common/HeaderControl";
import { useFavorites } from "~/hooks/useFavorites";
import { setFavorite } from "~/lib/favorite";

/** Stars the team among the viewer's favorites, or lets it go. */
export function FavoriteStar({ abbreviation }: { abbreviation: string }) {
  const favorite = useFavorites().includes(abbreviation.toUpperCase());
  return (
    <HeaderControl
      label="Favorite team"
      icon={Star}
      onClick={() => setFavorite(abbreviation, !favorite)}
      pressed={favorite}
      filled={favorite}
      // On, it rests a step up, where hovering takes it.
      tone={favorite ? "muted" : "faint"}
    />
  );
}
