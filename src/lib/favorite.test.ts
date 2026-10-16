import { describe, expect, it } from "vitest";
import { getFavorite, setFavorite } from "~/lib/favorite";

describe("favorite", () => {
  it("keeps one team, upper-cased, and clears it outright", () => {
    setFavorite("min");
    expect(getFavorite()).toBe("MIN");
    expect(window.localStorage.getItem("favorite-team")).toBe('"MIN"');
    setFavorite("GB");
    expect(getFavorite()).toBe("GB");
    setFavorite(null);
    expect(getFavorite()).toBeNull();
  });

  it("reads nothing from a missing or malformed value", () => {
    expect(getFavorite()).toBeNull();
    window.localStorage.setItem("favorite-team", '"MIN;evil"');
    expect(getFavorite()).toBeNull();
  });
});
