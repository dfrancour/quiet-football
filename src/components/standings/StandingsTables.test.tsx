import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  StandingsTables,
  type StandingsView,
} from "~/components/standings/StandingsTables";
import { TEAMS } from "~/lib/test-utils/fixtures";

const standings: StandingsView[] = [
  {
    conference: "NFC",
    divisions: [
      {
        division: "North",
        rows: [
          {
            team: TEAMS.MIN,
            record: { wins: 5, losses: 0, ties: 0 },
            mark: { seed: 1, clincher: "z" },
          },
          {
            team: TEAMS.CHI,
            record: { wins: 3, losses: 2, ties: 0 },
            mark: { seed: 9, clincher: null },
          },
        ],
      },
    ],
  },
];

function renderStandings(
  showSpoilers: boolean,
  props: Partial<React.ComponentProps<typeof StandingsTables>> = {},
) {
  render(
    <StandingsTables
      standings={standings}
      showSpoilers={showSpoilers}
      {...props}
    />,
  );
  return screen.getByRole("table", { name: "NFC North" });
}

function teamOrder(table: HTMLElement) {
  return within(table)
    .getAllByRole("rowheader")
    .map((cell) => cell.querySelector("a")?.getAttribute("href"));
}

describe("StandingsTables", () => {
  it("shows each team's line in standings order", () => {
    const table = renderStandings(true);
    expect(teamOrder(table)).toEqual(["/team/MIN", "/team/CHI"]);
    expect(within(table).getByText("5-0")).toBeInTheDocument();
    expect(within(table).getByText("3-2")).toBeInTheDocument();
  });

  it("marks the playoff race: seeds in the field and clinch codes", () => {
    const table = renderStandings(true);
    expect(within(table).getByTitle("Seed 1")).toHaveTextContent("1");
    expect(within(table).getByTitle("Clinched the division")).toHaveTextContent(
      "z",
    );
    // Ninth is out of the field.
    expect(within(table).queryByText("9")).not.toBeInTheDocument();
  });

  it("masks every figure and the order while spoilers are hidden", () => {
    const table = renderStandings(false);
    // Alphabetical, so the order does not give the table away either.
    expect(teamOrder(table)).toEqual(["/team/CHI", "/team/MIN"]);
    expect(within(table).queryByTitle("Seed 1")).not.toBeInTheDocument();
    expect(within(table).queryByText("z")).not.toBeInTheDocument();
    expect(within(table).queryByText("5-0")).not.toBeInTheDocument();
    expect(within(table).getAllByRole("img", { name: "Hidden" })).toHaveLength(
      2,
    );
  });

  it("lists a hidden division by the names it shows", () => {
    const line = (team: (typeof TEAMS)[keyof typeof TEAMS]) => ({
      team,
      record: { wins: 0, losses: 0, ties: 0 },
      mark: null,
    });
    render(
      <StandingsTables
        standings={[
          {
            conference: "NFC",
            divisions: [
              { division: "East", rows: [line(TEAMS.NYG), line(TEAMS.WSH)] },
            ],
          },
        ]}
        showSpoilers={false}
      />,
    );
    // Commanders before Giants, though New York comes before Washington.
    expect(teamOrder(screen.getByRole("table", { name: "NFC East" }))).toEqual([
      "/team/WSH",
      "/team/NYG",
    ]);
  });

  it("points at a team, and lights up a team pointed at elsewhere", () => {
    const onPoint = vi.fn();
    const table = renderStandings(true, {
      onPoint,
      highlighted: new Set([TEAMS.CHI.teamId]),
      favorites: new Set([TEAMS.MIN.teamId, TEAMS.CHI.teamId]),
    });
    const [min, chi] = within(table).getAllByRole("row");
    // Pointed at, a favorite lights up as any team does.
    expect(chi).toHaveClass("bg-surface-raised");
    expect(chi).not.toHaveClass("team-tint");
    expect(min).toHaveClass("team-tint");
    fireEvent.mouseEnter(min!);
    expect(onPoint).toHaveBeenLastCalledWith([TEAMS.MIN.teamId]);
  });
});
