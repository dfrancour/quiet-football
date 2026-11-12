import { describe, expect, it } from "vitest";
import {
  aboutPath,
  standingsPath,
  teamFeedUrl,
  teamPath,
  weekFromQuery,
} from "~/lib/routes";

const query = (search: string) => new URLSearchParams(search);

describe("routes", () => {
  it("names the league and a team, upper-cased", () => {
    expect(standingsPath()).toBe("/");
    expect(teamPath("sea")).toBe("/team/SEA");
    expect(aboutPath()).toBe("/about");
  });

  it("opens a team page on its game in one week of a season, by week rather than id", () => {
    expect(teamPath("SEA", { season: 2026, week: "5" })).toBe(
      "/team/SEA?season=2026&week=5",
    );
    expect(teamPath("SEA", { season: 2026, week: "wild-card" })).toBe(
      "/team/SEA?season=2026&week=wild-card",
    );
  });

  it("names a team's recap feed by its lower-cased abbreviation", () => {
    expect(teamFeedUrl("MIN")).toBe(
      "https://feeds.quiet-football.com/nfl/min.atom",
    );
  });

  it("reads the week a URL names in the season shown", () => {
    expect(weekFromQuery(query("season=2026&week=5"), 2026, 18)).toBe(5);
    expect(weekFromQuery(query("season=2026&week=wild-card"), 2026, 18)).toBe(
      19,
    );
  });

  it("takes a URL with no season to mean the one shown", () => {
    expect(weekFromQuery(query("week=5"), 2026, 18)).toBe(5);
    expect(weekFromQuery(query(""), 2026, 18)).toBeNull();
  });

  it("opens on no week when the URL names another season", () => {
    expect(weekFromQuery(query("season=2025&week=5"), 2026, 18)).toBeNull();
    expect(weekFromQuery(query("season=2027&week=5"), 2026, 18)).toBeNull();
    expect(weekFromQuery(query("season=next&week=5"), 2026, 18)).toBeNull();
  });
});
