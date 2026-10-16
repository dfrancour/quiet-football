import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bracket } from "~/components/playoffs/Bracket";
import { buildBracket } from "~/lib/playoffs";
import {
  REGISTRY,
  TEAMS,
  makeSeason,
  makeSeasonGame,
} from "~/lib/test-utils/fixtures";

type Side = { teamId: string };

function game(
  id: string,
  week: number,
  home: Side,
  homeScore: number,
  away: Side,
  awayScore: number,
) {
  return makeSeasonGame({
    gameId: id,
    week,
    kickoff: `2027-01-${String(week - 8).padStart(2, "0")}T18:00:00.000Z`,
    status: "final",
    home: { teamId: home.teamId, score: homeScore },
    away: { teamId: away.teamId, score: awayScore },
  });
}

const marks = {
  season: 2026,
  fetchedAt: "2027-01-05T00:00:00.000Z",
  teams: {
    [TEAMS.MIN.teamId]: { seed: 1, clincher: "*" },
    [TEAMS.NYG.teamId]: { seed: 2, clincher: "z" },
    [TEAMS.DET.teamId]: { seed: 3, clincher: "z" },
    [TEAMS.NO.teamId]: { seed: 4, clincher: "z" },
    [TEAMS.TB.teamId]: { seed: 5, clincher: "x" },
    [TEAMS.CHI.teamId]: { seed: 6, clincher: "x" },
    [TEAMS.GB.teamId]: { seed: 7, clincher: "x" },
  },
};

const wildCard = [
  game("wc-2-7", 19, TEAMS.NYG, 17, TEAMS.GB, 24),
  game("wc-3-6", 19, TEAMS.DET, 30, TEAMS.CHI, 10),
  game("wc-4-5", 19, TEAMS.NO, 13, TEAMS.TB, 20),
];
const divisional = [
  game("div-1-7", 20, TEAMS.MIN, 27, TEAMS.GB, 20),
  game("div-3-5", 20, TEAMS.DET, 21, TEAMS.TB, 24),
];

function renderBracket(
  games: ReturnType<typeof game>[],
  { open = true, seen = false }: { open?: boolean; seen?: boolean } = {},
) {
  render(
    <Bracket
      bracket={buildBracket(makeSeason(games), REGISTRY, marks)}
      totalWeeks={18}
      isShown={() => seen}
      isOpen={() => open}
      favoriteTeamId={null}
    />,
  );
}

const linkOrder = () =>
  screen.getAllByRole("link").map((link) => link.getAttribute("href"));

describe("Bracket", () => {
  it("heads each round, left to right", () => {
    renderBracket(wildCard);
    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Wild Card", "Divisional", "Conference", "Super Bowl"]);
  });

  it("lists the Wild Card round by seed, the bye first, until the next is set", () => {
    renderBracket(wildCard);
    expect(linkOrder()).toEqual([
      "/team/MIN",
      "/team/GB?week=wild-card",
      "/team/NYG?week=wild-card",
      "/team/CHI?week=wild-card",
      "/team/DET?week=wild-card",
      "/team/TB?week=wild-card",
      "/team/NO?week=wild-card",
    ]);
    expect(screen.getAllByText("Bye")).toHaveLength(1);
  });

  it("puts each Wild Card game beside the Divisional game it filled", () => {
    // The 2, 6 and 5 seeds won: the 1 hosts the 6, the 2 hosts the 5.
    renderBracket([
      game("wc-2-7", 19, TEAMS.NYG, 24, TEAMS.GB, 17),
      game("wc-3-6", 19, TEAMS.DET, 10, TEAMS.CHI, 30),
      game("wc-4-5", 19, TEAMS.NO, 13, TEAMS.TB, 20),
      game("div-1-6", 20, TEAMS.MIN, 27, TEAMS.CHI, 20),
      game("div-2-5", 20, TEAMS.NYG, 21, TEAMS.TB, 24),
    ]);
    const wildCardLinks = linkOrder().filter((href) =>
      href?.endsWith("wild-card"),
    );
    expect(wildCardLinks).toEqual([
      "/team/CHI?week=wild-card",
      "/team/DET?week=wild-card",
      "/team/GB?week=wild-card",
      "/team/NYG?week=wild-card",
      "/team/TB?week=wild-card",
      "/team/NO?week=wild-card",
    ]);
  });

  it("masks scores until the game is seen", () => {
    renderBracket(wildCard);
    expect(screen.queryByText("24")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Hidden" })).toHaveLength(6);
  });

  it("marks the winner and fades the loser once seen", () => {
    renderBracket(wildCard, { seen: true });
    expect(screen.getByText("24")).toHaveClass("font-semibold");
    const loser = screen.getByRole("link", { name: /NYG/ });
    expect(loser).toHaveClass("opacity-45");
  });

  it("covers matchups and the bye until the round before is seen", () => {
    renderBracket([...wildCard, ...divisional], { open: false });
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.queryByText("GB")).not.toBeInTheDocument();
    expect(screen.queryByText(/Seed/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Bye")).toHaveLength(1);
  });
});
