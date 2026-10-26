import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeApp } from "~/components/HomeApp";
import { markIntroduced, resetIntroducedCache } from "~/lib/first-run";
import { catchUpThrough, setShowAll } from "~/lib/spoilers";
import { TEAMS } from "~/lib/test-utils/fixtures";
import { stubLeague, type LeagueGame } from "~/lib/test-utils/league";
import { queryWrapper, requestUrl } from "~/lib/test-utils/query";

const NOW = Date.parse("2026-10-16T12:00:00Z");

/** Three weeks played in the NFC North and beyond, and a fourth to come. */
const GAMES: LeagueGame[] = [
  {
    id: "w1a",
    week: 1,
    kickoff: "2026-09-13T17:00:00Z",
    away: TEAMS.MIN,
    home: TEAMS.NO,
    score: [24, 10],
  },
  {
    id: "w1b",
    week: 1,
    kickoff: "2026-09-13T20:25:00Z",
    away: TEAMS.CHI,
    home: TEAMS.GB,
    score: [17, 20],
  },
  {
    id: "w2a",
    week: 2,
    kickoff: "2026-09-20T17:00:00Z",
    away: TEAMS.CHI,
    home: TEAMS.MIN,
    score: [21, 14],
  },
  {
    id: "w3a",
    week: 3,
    kickoff: "2026-09-27T17:00:00Z",
    away: TEAMS.MIN,
    home: TEAMS.GB,
    score: [27, 3],
  },
  {
    id: "w4a",
    week: 4,
    kickoff: "2026-10-18T17:00:00Z",
    away: TEAMS.DET,
    home: TEAMS.MIN,
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // A viewer who has found the spoiler control, so it waits to be opened.
  markIntroduced();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetIntroducedCache();
});

async function renderLeague() {
  const fetchMock = stubLeague(GAMES);
  render(<HomeApp />, { wrapper: queryWrapper() });
  const north = await screen.findByRole("table", { name: "NFC North" });
  return { fetchMock, north };
}

/** Each row of a standings table, as it reads: the team, then its figures. */
function rows(table: HTMLElement) {
  return within(table)
    .getAllByRole("row")
    .map((row) => row.textContent.replace("Record ", " "));
}

const schedule = () => screen.getByRole("region", { name: "Schedule" });

describe("HomeApp", () => {
  it("covers every figure and the order of the standings to start", async () => {
    const { north } = await renderLeague();
    expect(rows(north)).toEqual(["Bears ", "Lions ", "Packers ", "Vikings "]);
    expect(within(north).queryByText(/\d-\d/)).not.toBeInTheDocument();
    expect(within(north).queryByTitle(/Seed/)).not.toBeInTheDocument();
  });

  it("counts the standings only through the week caught up through", async () => {
    catchUpThrough(2026, 1);
    const { north } = await renderLeague();
    const vikings = rows(north).find((row) => row.startsWith("Vikings"));
    const bears = rows(north).find((row) => row.startsWith("Bears"));
    // Week 2, Bears over Vikings, is not counted yet.
    expect(vikings).toContain("1-0");
    expect(bears).toContain("0-1");
    // Seeds describe the present, so wait for the whole regular season.
    expect(within(north).queryByTitle(/Seed/)).not.toBeInTheDocument();
  });

  it("opens on the week after the one caught up through, its scores covered", async () => {
    catchUpThrough(2026, 1);
    await renderLeague();
    expect(
      within(schedule()).getByRole("button", { name: "Week 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(schedule()).queryByText("21")).not.toBeInTheDocument();
    expect(
      within(schedule()).getAllByRole("img", { name: "Hidden" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens on the league's week, everything shown, once Show all is on", async () => {
    setShowAll(true);
    const { north, fetchMock } = await renderLeague();
    expect(
      within(schedule()).getByRole("button", { name: "Week 4, this week" }),
    ).toHaveAttribute("aria-pressed", "true");
    const vikings = rows(north).find((row) => row.startsWith("Vikings"));
    expect(vikings).toContain("2-1");
    expect(within(north).getAllByTitle("Seed 1").length).toBeGreaterThan(0);
    // The registry's standings serve the marks too: asked for once.
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        requestUrl(url).includes("/standings"),
      ),
    ).toHaveLength(1);
  });
});
