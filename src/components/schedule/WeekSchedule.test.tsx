import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { WeekSchedule } from "~/components/schedule/WeekSchedule";
import { type GateGame } from "~/lib/playoffs";
import { type BoardGame } from "~/lib/score.schema";
import { TEAMS } from "~/lib/test-utils/fixtures";
import { recordWatchProgress } from "~/lib/watch-progress";
import { type WeekGame } from "~/lib/week";

const played: WeekGame = {
  gameId: "401872987",
  week: 5,
  round: null,
  gate: [],
  kickoff: "2026-10-11T17:00:00.000Z",
  status: "final",
  broadcast: "Fox",
  away: {
    team: TEAMS.MIN,
    score: 23,
    recordBefore: { wins: 4, losses: 0, ties: 0 },
  },
  home: {
    team: TEAMS.NO,
    score: 13,
    recordBefore: { wins: 1, losses: 3, ties: 0 },
  },
};

const next: WeekGame = {
  gameId: "401872999",
  week: 6,
  round: null,
  gate: [],
  kickoff: "2026-10-18T17:00:00.000Z",
  status: "scheduled",
  broadcast: "CBS",
  away: {
    team: TEAMS.GB,
    score: null,
    recordBefore: { wins: 0, losses: 0, ties: 0 },
  },
  home: {
    team: TEAMS.CHI,
    score: null,
    recordBefore: { wins: 0, losses: 0, ties: 0 },
  },
};

function renderSchedule(
  revealed: boolean,
  {
    games = [played, next],
    board = [] as readonly BoardGame[],
    currentWeek = 5,
    highlighted = new Set<string>(),
    favoriteTeamId = null as string | null,
    onPoint = () => undefined,
    isOpen = () => true,
  }: {
    games?: WeekGame[];
    board?: readonly BoardGame[];
    currentWeek?: number;
    highlighted?: ReadonlySet<string>;
    favoriteTeamId?: string | null;
    onPoint?: (teamIds: readonly string[]) => void;
    isOpen?: (gate: readonly GateGame[]) => boolean;
  } = {},
) {
  // The page owns the week, as the home page does.
  function Harness() {
    const [week, setWeek] = useState(currentWeek);
    return (
      <WeekSchedule
        games={games}
        week={week}
        board={board}
        onWeekChange={setWeek}
        currentWeek={currentWeek}
        totalWeeks={18}
        isShown={() => revealed}
        isOpen={isOpen}
        showsRecordsBefore={() => revealed}
        highlighted={highlighted}
        favoriteTeamId={favoriteTeamId}
        onPoint={onPoint}
      />
    );
  }
  render(<Harness />);
}

const links = () =>
  screen.getAllByRole("link").map((link) => link.getAttribute("href"));

const hidden = () => screen.queryAllByRole("img", { name: "Hidden" });

/** A game under way now, in overtime by the scoreboard's account. */
function overtime(completed: boolean) {
  const kickoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const game: WeekGame = {
    ...played,
    gameId: "live",
    kickoff,
    status: completed ? "final" : "in_progress",
  };
  const board: BoardGame[] = [
    {
      gameId: "live",
      state: completed ? "post" : "in",
      detail: completed ? "Final/OT" : "10:00 - OT",
      period: 5,
      clock: completed ? "0:00" : "10:00",
      completed,
      away: { abbreviation: "MIN", score: 20 },
      home: { abbreviation: "NO", score: completed ? 23 : 20 },
    },
  ];
  return { game, board };
}

describe("WeekSchedule", () => {
  it("opens on the current week", () => {
    renderSchedule(false);
    expect(screen.getByRole("button", { name: "5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(links()).toEqual(["/team/MIN?week=5", "/team/NO?week=5"]);
  });

  it("masks a played game's scores until spoilers are shown", () => {
    renderSchedule(false);
    expect(hidden()).toHaveLength(2);
    expect(screen.queryByText("23")).not.toBeInTheDocument();
    expect(screen.queryByText("4-0")).not.toBeInTheDocument();
  });

  it("shows the scores once spoilers are on", () => {
    renderSchedule(true);
    const card = screen.getByRole("row");
    expect(within(card).getByText("23")).toBeInTheDocument();
    expect(within(card).getByText("13")).toBeInTheDocument();
    // Each side's record going in, beside its name.
    expect(within(card).getByText("4-0")).toBeInTheDocument();
    expect(within(card).getByText("1-3")).toBeInTheDocument();
  });

  it("moves between weeks in place", () => {
    renderSchedule(false);
    fireEvent.click(screen.getByRole("button", { name: "6" }));
    expect(links()).toEqual(["/team/GB?week=6", "/team/CHI?week=6"]);
    // A future game says when, not a score.
    const card = screen.getByRole("row");
    expect(within(card).queryAllByRole("img", { name: "Hidden" })).toEqual([]);
    expect(within(card).getByText("CBS")).toBeInTheDocument();
  });

  it("says Final, not how far the viewer watched", () => {
    recordWatchProgress(played.gameId, {
      playId: "p1",
      finished: false,
    });
    renderSchedule(false);
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  it("gives a game under way its own clock, however far it was watched", async () => {
    const { game, board } = overtime(false);
    recordWatchProgress(game.gameId, {
      playId: "p1",
      finished: false,
    });
    renderSchedule(false, { games: [game], board });
    expect(await screen.findByText("Q4+")).toBeInTheDocument();
  });

  it("never says overtime about a hidden game under way", async () => {
    const { game, board } = overtime(false);
    renderSchedule(false, { games: [game], board });
    expect(await screen.findByText("Q4+")).toBeInTheDocument();
    expect(screen.queryByText(/OT/)).not.toBeInTheDocument();
  });

  it("reads a hidden game the scoreboard has just finished as Final", async () => {
    const { game, board } = overtime(true);
    renderSchedule(false, { games: [game], board });
    expect(await screen.findByText("Final")).toBeInTheDocument();
    expect(screen.queryByText(/OT/)).not.toBeInTheDocument();
  });

  it("gives the overtime clock once the game is revealed", async () => {
    const { game, board } = overtime(false);
    renderSchedule(true, { games: [game], board });
    expect(await screen.findByText("OT - 10:00")).toBeInTheDocument();
  });

  it("points at both teams of a game, and lights up a pointed-at team's game", () => {
    const onPoint = vi.fn();
    renderSchedule(false, { onPoint, highlighted: new Set([TEAMS.NO.teamId]) });
    const row = screen.getByRole("row");
    expect(row).toHaveClass("bg-surface-raised");
    fireEvent.mouseEnter(row);
    expect(onPoint).toHaveBeenLastCalledWith([
      TEAMS.MIN.teamId,
      TEAMS.NO.teamId,
    ]);
    fireEvent.mouseLeave(row);
    expect(onPoint).toHaveBeenLastCalledWith([]);
  });

  it("tints the favorite team's game", () => {
    renderSchedule(false, { favoriteTeamId: TEAMS.MIN.teamId });
    expect(screen.getByRole("row")).toHaveClass("bg-accent/10");
  });

  describe("on a phone", () => {
    const step = (name: string) => screen.getByRole("button", { name });
    const bar = () => screen.getByRole("button", { expanded: false });

    it("names the shown week and its days", () => {
      renderSchedule(false);
      expect(bar()).toHaveTextContent("Week 5 · Oct 11");
    });

    it("steps a week either way, and no further than the season", () => {
      renderSchedule(false);
      fireEvent.click(step("Next week"));
      expect(bar()).toHaveTextContent("Week 6 · Oct 18");
      expect(links()).toEqual(["/team/GB?week=6", "/team/CHI?week=6"]);
      fireEvent.click(step("Previous week"));
      expect(bar()).toHaveTextContent("Week 5");

      renderSchedule(false, { currentWeek: 1 });
      expect(
        screen.getAllByRole("button", { name: "Previous week" })[1],
      ).toBeDisabled();
    });

    it("opens every week as a sheet, closed by a pick", () => {
      renderSchedule(false);
      fireEvent.click(bar());
      const sheet = screen.getByRole("dialog", { name: "Weeks" });
      fireEvent.click(within(sheet).getByRole("button", { name: "6" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(bar()).toHaveTextContent("Week 6");
      expect(bar()).toHaveFocus();
    });
  });

  describe("in the playoffs", () => {
    const wildCard: WeekGame = {
      ...played,
      gameId: "wild-card",
      week: 19,
      round: "wild-card",
      gate: [{ gameId: played.gameId, week: played.week }],
      kickoff: "2027-01-16T21:30:00.000Z",
    };

    it("offers each round set so far after the regular season", () => {
      renderSchedule(false, { games: [played, wildCard], currentWeek: 19 });
      const round = screen.getByRole("button", { name: "Wild Card" });
      expect(round).toHaveTextContent("WC");
      expect(round).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { expanded: false })).toHaveTextContent(
        "Wild Card · Jan 16",
      );
      expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Divisional Round" }),
      ).not.toBeInTheDocument();
    });

    it("names the round in its links", () => {
      renderSchedule(false, { games: [wildCard], currentWeek: 19 });
      expect(links()).toEqual([
        "/team/MIN?week=wild-card",
        "/team/NO?week=wild-card",
      ]);
    });

    it("covers a matchup until the games deciding it are seen", () => {
      const onPoint = vi.fn();
      renderSchedule(false, {
        games: [wildCard],
        currentWeek: 19,
        isOpen: (gate) => !gate.some((entry) => entry.gameId === played.gameId),
        favoriteTeamId: TEAMS.MIN.teamId,
        onPoint,
      });
      const row = screen.getByRole("row");
      expect(within(row).queryByText("MIN")).not.toBeInTheDocument();
      expect(within(row).queryAllByRole("link")).toEqual([]);
      expect(within(row).getAllByRole("img", { name: "Hidden" })).toHaveLength(
        2,
      );
      // Neither the tint nor the standings may say who is playing.
      expect(row).not.toHaveClass("bg-accent/10");
      fireEvent.mouseEnter(row);
      expect(onPoint).not.toHaveBeenCalled();
    });
  });
});
