import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamApp } from "~/components/TeamApp";
import { markIntroduced, resetIntroducedCache } from "~/lib/first-run";
import { catchUpThrough } from "~/lib/spoilers";
import { TEAMS } from "~/lib/test-utils/fixtures";
import { stubLeague, type LeagueGame } from "~/lib/test-utils/league";
import { queryWrapper, requestUrl } from "~/lib/test-utils/query";
import { location, router } from "~/lib/test-utils/setup";

/** Two days after Wild Card weekend. */
const NOW = Date.parse("2027-01-12T12:00:00Z");

/** The Vikings' season: an opener, Week 18, and a Wild Card game, all won. */
const GAMES: LeagueGame[] = [
  {
    id: "opener",
    week: 1,
    kickoff: "2026-09-13T17:00:00Z",
    away: TEAMS.MIN,
    home: TEAMS.NO,
    score: [24, 10],
  },
  {
    id: "finale",
    week: 18,
    kickoff: "2027-01-03T18:00:00Z",
    away: TEAMS.GB,
    home: TEAMS.MIN,
    score: [10, 20],
  },
  {
    id: "wild-card",
    week: 19,
    kickoff: "2027-01-10T21:30:00Z",
    away: TEAMS.NO,
    home: TEAMS.MIN,
    score: [13, 27],
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  markIntroduced();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetIntroducedCache();
});

async function renderTeam(abbreviation = "MIN") {
  const fetchMock = stubLeague(GAMES);
  render(<TeamApp abbreviation={abbreviation} />, {
    wrapper: queryWrapper(),
  });
  await screen.findByRole("heading", { name: "Minnesota Vikings" });
  return fetchMock;
}

/** The record beside the team's name; null while it is covered. */
function headerRecord() {
  const figure = screen
    .getByRole("heading", { name: "Minnesota Vikings" })
    .parentElement?.querySelector(".font-mono");
  return figure?.querySelector('[role="img"]') ? null : figure?.textContent;
}

const summaryCalls = (fetchMock: ReturnType<typeof stubLeague>) =>
  fetchMock.mock.calls
    .map(([url]) => requestUrl(url))
    .filter((url) => url.includes("/summary"));

describe("TeamApp", () => {
  it("leaves out a playoff game the viewer may not see, whatever the URL says", async () => {
    location.search = new URLSearchParams("week=wild-card");
    await renderTeam();
    // Not in the schedule, nor on the panel: its being there says MIN won.
    expect(screen.queryByTitle("Wild Card")).not.toBeInTheDocument();
    expect(screen.queryByText(/Wild Card/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Week 18").length).toBeGreaterThan(0);
  });

  it("opens a playoff URL on its game once the round before is seen", async () => {
    catchUpThrough(2026, 18);
    location.search = new URLSearchParams("week=wild-card");
    await renderTeam();
    expect(screen.getByTitle("Wild Card")).toBeInTheDocument();
    expect(screen.getAllByText(/Wild Card/).length).toBeGreaterThan(0);
  });

  it("covers the team's record until a week is caught up through", async () => {
    await renderTeam();
    expect(headerRecord()).toBeNull();
  });

  it("counts the team's record only through the week caught up through", async () => {
    catchUpThrough(2026, 1);
    await renderTeam();
    expect(headerRecord()).toBe("Record 1-0");
  });

  it("counts the regular season once caught up through it", async () => {
    catchUpThrough(2026, 18);
    await renderTeam();
    // The Wild Card win is not a regular-season game.
    expect(headerRecord()).toBe("Record 2-0");
  });

  it("asks for a covered game's plays only once the viewer would see them", async () => {
    const fetchMock = await renderTeam();
    // Week 18, final and covered, with no place in it: nothing asked.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(summaryCalls(fetchMock)).toEqual([]);
  });

  it("leaves a game's plays alone while its result is covered, matchup or not", async () => {
    // The Wild Card matchup shows, but not how it went.
    catchUpThrough(2026, 18);
    const fetchMock = await renderTeam();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(summaryCalls(fetchMock)).toEqual([]);
  });

  it("asks for a shown game's plays", async () => {
    catchUpThrough(2026, 19);
    const fetchMock = await renderTeam();
    // Wild Card weekend was two days ago: the page opens on it.
    await waitFor(() =>
      expect(summaryCalls(fetchMock)).toEqual([
        expect.stringContaining("event=wild-card"),
      ]),
    );
  });

  it("sends a team ESPN does not know to the standings", async () => {
    stubLeague(GAMES);
    render(<TeamApp abbreviation="XYZ" />, { wrapper: queryWrapper() });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
