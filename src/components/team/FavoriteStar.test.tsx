import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FavoriteStar } from "~/components/team/FavoriteStar";
import { getFavorite } from "~/lib/favorite";

const star = () => screen.getByRole("button", { name: "Favorite team" });

describe("FavoriteStar", () => {
  it("makes the team the favorite, and lets it go again", () => {
    render(<FavoriteStar abbreviation="MIN" />);
    expect(star()).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star());
    expect(star()).toHaveAttribute("aria-pressed", "true");
    expect(getFavorite()).toBe("MIN");

    fireEvent.click(star());
    expect(star()).toHaveAttribute("aria-pressed", "false");
    expect(getFavorite()).toBeNull();
  });

  it("replaces another team as the favorite", () => {
    window.localStorage.setItem("favorite-team", '"GB"');
    render(<FavoriteStar abbreviation="MIN" />);
    expect(star()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(star());
    expect(getFavorite()).toBe("MIN");
  });
});
