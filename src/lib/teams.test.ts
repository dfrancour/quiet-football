import { describe, expect, it } from "vitest";
import { teamByAbbreviation, teamById } from "~/lib/teams";
import { REGISTRY, TEAMS } from "~/lib/test-utils/fixtures";

describe("teamById", () => {
  it("finds a team by its ESPN id", () => {
    expect(teamById(REGISTRY, "16")?.abbreviation).toBe("MIN");
  });

  it("returns null for an unknown id", () => {
    expect(teamById(REGISTRY, "999")).toBeNull();
  });
});

describe("teamByAbbreviation", () => {
  it("is case-insensitive", () => {
    expect(teamByAbbreviation(REGISTRY, "min")?.teamId).toBe(TEAMS.MIN.teamId);
    expect(teamByAbbreviation(REGISTRY, "MIN")?.teamId).toBe(TEAMS.MIN.teamId);
  });

  it("returns null for an unknown abbreviation", () => {
    expect(teamByAbbreviation(REGISTRY, "XXX")).toBeNull();
  });
});
