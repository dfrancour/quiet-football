import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FavoriteStar } from "~/components/team/FavoriteStar";
import { getFavorites } from "~/lib/favorite";

const star = () => screen.getByRole("button", { name: "Favorite team" });

describe("FavoriteStar", () => {
  it("makes the team a favorite, and lets it go again", () => {
    render(<FavoriteStar abbreviation="MIN" />);
    expect(star()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star());
    expect(star()).toHaveAttribute("aria-pressed", "true");
    expect(getFavorites()).toEqual(["MIN"]);

    fireEvent.click(star());
    expect(star()).toHaveAttribute("aria-pressed", "false");
    expect(getFavorites()).toEqual([]);
  });

  it("adds the team beside the other favorites", () => {
    window.localStorage.setItem("favorite-team", '["GB"]');
    render(<FavoriteStar abbreviation="MIN" />);
    expect(star()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(star());
    expect(getFavorites()).toEqual(["GB", "MIN"]);
  });
});
