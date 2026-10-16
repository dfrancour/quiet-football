import { describe, expect, it } from "vitest";
import { aboutPath, standingsPath, teamPath } from "~/lib/routes";

describe("routes", () => {
  it("names the league and a team, upper-cased", () => {
    expect(standingsPath()).toBe("/");
    expect(teamPath("sea")).toBe("/team/SEA");
    expect(aboutPath()).toBe("/about");
  });

  it("opens a team page on its game in one week, by week rather than id", () => {
    expect(teamPath("SEA", "5")).toBe("/team/SEA?week=5");
    expect(teamPath("SEA", "wild-card")).toBe("/team/SEA?week=wild-card");
  });
});
