import { describe, expect, it } from "vitest";
import { getFavorites, setFavorite } from "~/lib/favorite";

describe("favorite", () => {
  it("keeps several teams, upper-cased, in the order starred", () => {
    setFavorite("min", true);
    setFavorite("GB", true);
    expect(getFavorites()).toEqual(["MIN", "GB"]);
    expect(window.localStorage.getItem("favorite-team")).toBe('["MIN","GB"]');
    setFavorite("MIN", true);
    expect(getFavorites()).toEqual(["GB", "MIN"]);
    setFavorite("gb", false);
    expect(getFavorites()).toEqual(["MIN"]);
    setFavorite("MIN", false);
    expect(getFavorites()).toEqual([]);
  });

  it("reads a lone team as a list of one", () => {
    window.localStorage.setItem("favorite-team", '"MIN"');
    expect(getFavorites()).toEqual(["MIN"]);
    setFavorite("GB", true);
    expect(getFavorites()).toEqual(["MIN", "GB"]);
  });

  it("reads nothing from a missing or malformed value", () => {
    expect(getFavorites()).toEqual([]);
    window.localStorage.setItem("favorite-team", '["MIN;evil"]');
    expect(getFavorites()).toEqual([]);
    window.localStorage.setItem("favorite-team", "null");
    expect(getFavorites()).toEqual([]);
  });
});
