import { describe, expect, it } from "vitest";
import { aboutMetadata, homeMetadata, teamMetadata } from "~/lib/metadata";
import { TEAM_ABBREVIATIONS, teamName } from "~/lib/teams";

describe("teamMetadata", () => {
  it("titles a team page by the team's name", () => {
    const metadata = teamMetadata("MIN");
    expect(metadata.title).toEqual({
      absolute: "Minnesota Vikings | Quiet Football",
    });
    expect(metadata.description).toMatch(/^Minnesota Vikings schedule/);
    expect(metadata.alternates?.canonical).toBe("/team/MIN");
  });

  it("shares a team page as itself, not the home page", () => {
    const metadata = teamMetadata("sea");
    expect(metadata.openGraph).toMatchObject({
      title: "Seattle Seahawks | Quiet Football",
      url: "/team/SEA",
    });
    expect(metadata.openGraph?.images).toBeDefined();
    expect(metadata.twitter).toMatchObject({
      title: "Seattle Seahawks | Quiet Football",
    });
  });

  it("keeps every team's title short enough for a search result", () => {
    for (const abbreviation of TEAM_ABBREVIATIONS) {
      const { title } = teamMetadata(abbreviation);
      expect(title).toHaveProperty("absolute");
      const absolute = (title as { absolute: string }).absolute;
      expect(absolute.length).toBeLessThanOrEqual(60);
    }
  });
});

describe("teamName", () => {
  it("names every team page's team, whatever the case", () => {
    expect(teamName("gb")).toBe("Green Bay Packers");
    for (const abbreviation of TEAM_ABBREVIATIONS) {
      expect(teamName(abbreviation)).not.toBe(abbreviation);
    }
  });

  it("falls back to the abbreviation for a team it does not know", () => {
    expect(teamName("xyz")).toBe("XYZ");
    expect(teamName("constructor")).toBe("CONSTRUCTOR");
  });
});

describe("page metadata", () => {
  it("gives the home and about pages their own address when shared", () => {
    expect(homeMetadata().openGraph).toMatchObject({ url: "/" });
    expect(aboutMetadata().openGraph).toMatchObject({ url: "/about" });
    expect(aboutMetadata().title).toEqual({
      absolute: "About | Quiet Football",
    });
  });
});
