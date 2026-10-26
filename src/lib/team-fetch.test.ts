import { describe, expect, it } from "vitest";
import { scoreboardSchema } from "~/lib/score.schema";
import {
  pickLogoHref,
  teamColors,
  type TeamColors,
  teamRegistryFromEspn,
} from "~/lib/team-fetch";

function espnTeam(id: string, abbreviation: string, extra: object = {}) {
  return {
    id,
    abbreviation,
    displayName: `${abbreviation} Team`,
    shortDisplayName: abbreviation,
    name: `${abbreviation}s`,
    location: `${abbreviation} City`,
    ...extra,
  };
}

function standingsPayload(
  divisions: { conference: string; name: string; teams: object[] }[],
) {
  const byConference = new Map<string, typeof divisions>();
  for (const division of divisions) {
    byConference.set(division.conference, [
      ...(byConference.get(division.conference) ?? []),
      division,
    ]);
  }
  return {
    children: [...byConference].map(([abbreviation, entries]) => ({
      abbreviation,
      children: entries.map((division) => ({
        name: division.name,
        standings: { entries: division.teams.map((team) => ({ team })) },
      })),
    })),
  };
}

const NO_COLORS = new Map<string, TeamColors>();

describe("pickLogoHref", () => {
  it("takes the full dark mark over the default", () => {
    expect(
      pickLogoHref([
        { href: "default.png", rel: ["full", "default"] },
        { href: "dark.png", rel: ["full", "scoreboard", "dark"] },
      ]),
    ).toBe("dark.png");
  });

  it("falls back to the default, and to nothing", () => {
    expect(
      pickLogoHref([{ href: "default.png", rel: ["full", "default"] }]),
    ).toBe("default.png");
    expect(pickLogoHref([{ href: "brand.png", rel: ["guid"] }])).toBeNull();
    expect(pickLogoHref(undefined)).toBeNull();
  });
});

describe("teamColors", () => {
  it("reads each team's color from a scoreboard, by id", () => {
    const colors = teamColors(
      scoreboardSchema.parse({
        events: [
          {
            id: 1,
            competitions: [
              {
                competitors: [
                  {
                    team: { id: 16, color: "4f2683", alternateColor: "ffc62f" },
                  },
                  { team: { id: "18", color: "d3bc8d" } },
                  { team: { id: "9" } },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect([...colors]).toEqual([
      ["16", { color: "4f2683", alternateColor: "ffc62f" }],
      ["18", { color: "d3bc8d", alternateColor: null }],
    ]);
  });
});

describe("teamRegistryFromEspn", () => {
  it("builds the registry from the standings, sorted, with colors by id", () => {
    const registry = teamRegistryFromEspn(
      standingsPayload([
        {
          conference: "NFC",
          name: "NFC North",
          teams: [
            espnTeam("16", "MIN", {
              logos: [
                { href: "https://example.test/min.png", rel: ["full", "dark"] },
              ],
            }),
            espnTeam("9", "GB"),
          ],
        },
        { conference: "AFC", name: "AFC East", teams: [espnTeam("2", "BUF")] },
      ]),
      new Map([["16", { color: "4f2683", alternateColor: "ffc62f" }]]),
    );
    expect(registry.teams.map((team) => team.abbreviation)).toEqual([
      "BUF",
      "GB",
      "MIN",
    ]);
    expect(registry.teams[2]).toEqual({
      teamId: "16",
      abbreviation: "MIN",
      displayName: "MIN Team",
      nickname: "MINs",
      color: "4f2683",
      alternateColor: "ffc62f",
      conference: "NFC",
      division: "North",
      logo: "https://example.test/min.png",
    });
    expect(registry.teams[1]).toMatchObject({
      color: null,
      alternateColor: null,
      logo: null,
      conference: "NFC",
      division: "North",
    });
    expect(registry.teams[0]).toMatchObject({
      conference: "AFC",
      division: "East",
    });
  });

  it("fills a missing name from the ones ESPN did send", () => {
    const registry = teamRegistryFromEspn(
      standingsPayload([
        {
          conference: "NFC",
          name: "NFC North",
          teams: [{ id: 9, abbreviation: "GB" }],
        },
      ]),
      NO_COLORS,
    );
    expect(registry.teams[0]).toMatchObject({
      teamId: "9",
      displayName: "GB",
      nickname: "GB",
      color: null,
    });
  });

  it("refuses a team outside a known conference or division, which would vanish from the standings", () => {
    expect(() =>
      teamRegistryFromEspn(
        standingsPayload([
          {
            conference: "NFC",
            name: "NFC North",
            teams: [espnTeam("16", "MIN")],
          },
          {
            conference: "NFC",
            name: "NFC Central",
            teams: [espnTeam("99", "XXX")],
          },
        ]),
        NO_COLORS,
      ),
    ).toThrow(/No division for XXX/);
    expect(() =>
      teamRegistryFromEspn(
        standingsPayload([
          {
            conference: "XFL",
            name: "XFL North",
            teams: [espnTeam("99", "XXX")],
          },
        ]),
        NO_COLORS,
      ),
    ).toThrow(/No division for XXX/);
  });

  it("refuses an empty league and a payload it cannot read", () => {
    expect(() => teamRegistryFromEspn(standingsPayload([]), NO_COLORS)).toThrow(
      /no teams/,
    );
    expect(() =>
      teamRegistryFromEspn({ children: "nope" }, NO_COLORS),
    ).toThrow();
  });
});
