import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameDetail } from "~/components/game/GameDetail";
import { extractPlayByPlay, playsInOrder } from "~/lib/plays";
import { type PlayByPlay } from "~/lib/plays.schema";
import { type LiveScore } from "~/lib/score.schema";
import { PREGAME_WINDOW_MS } from "~/lib/schedule";
import { SHORT_GAME } from "~/lib/test-utils/espn-summaries";
import { TEAMS, makeRecaps, makeTeamGame } from "~/lib/test-utils/fixtures";
import { cycleBroadcastDelay } from "~/lib/broadcast-delay";
import { noteGameClock } from "~/lib/game-clocks";
import { notePlayArrivals } from "~/lib/play-arrivals";
import { getWatchProgress, recordWatchProgress } from "~/lib/watch-progress";

const KICKOFF_MS = Date.parse("2026-10-11T17:00:00.000Z");
const AFTER_GAME_MS = KICKOFF_MS + 5 * 60 * 60 * 1000;

const finalGame = makeTeamGame({
  status: "final",
  result: { teamScore: 20, opponentScore: 13, outcome: "win" },
});

/**
 * A recorded `final` always beats the clock, so a game under way must not carry
 * that status or the live branch is unreachable.
 */
const liveGame = makeTeamGame({ status: "in_progress" });

const liveScore: LiveScore = {
  gameId: finalGame.gameId,
  state: "in",
  detail: "8:21 - 4th",
  period: 4,
  clock: "8:21",
  completed: false,
  team: { abbreviation: "MIN", score: 20, periods: [3, 7, 0, 10] },
  opponent: { abbreviation: "NO", score: 13, periods: [7, 3, 3, 0] },
  situation: null,
};

const liveScoreWithSituation: LiveScore = {
  ...liveScore,
  gameId: liveGame.gameId,
  situation: {
    downDistance: "3rd & 4 at NO 18",
    possession: "team",
    isRedZone: true,
    timeouts: { team: 2, opponent: 1 },
    lastPlay: "J.McCarthy pass short right to J.Jefferson for 6 yards.",
    drive: "8 plays, 57 yards, 4:02",
    // MIN is away at NO, so the Vikings count down toward the Saints' goal.
    field: {
      offense: "away",
      ballOn: 18,
      lineToGain: 14,
      driveSpots: [75, 18],
    },
  },
};

/** The covered figures, whether or not they can be tapped open. */
const covered = () => [
  ...screen.queryAllByRole("img", { name: "Hidden" }),
  ...screen.queryAllByRole("button", { name: /^Reveal score/ }),
];

function renderDetail(
  overrides: Partial<React.ComponentProps<typeof GameDetail>> = {},
) {
  return render(
    <GameDetail
      game={finalGame}
      now={AFTER_GAME_MS}
      team={TEAMS.MIN}
      score={liveScore}
      scoreError={null}
      showSpoilers={false}
      recaps={makeRecaps()}
      {...overrides}
    />,
  );
}

describe("GameDetail selection states", () => {
  it("waits for the clock rather than guessing a phase", () => {
    renderDetail({ now: null });
    expect(screen.queryByText(/Final/)).not.toBeInTheDocument();
  });

  it("explains an empty season", () => {
    renderDetail({ game: null });
    expect(screen.getByText(/No games on the calendar/)).toBeInTheDocument();
  });

  it("offers no recap for a played game until one is linked", () => {
    renderDetail();
    expect(
      screen.getByRole("button", { name: /Week 5, final/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /recap/i })).toBeNull();
    expect(screen.queryByText(/YouTube/)).toBeNull();
  });

  it("links out to a recap, as an icon in the top row, once one is found", () => {
    renderDetail({
      recaps: makeRecaps({
        [finalGame.gameId]: {
          youtubeId: "YHo13wCIHT4",
          publishedAt: "2026-10-11T21:00:00Z",
        },
      }),
    });
    expect(screen.getByRole("link", { name: /Watch recap/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=YHo13wCIHT4",
    );
  });

  it("shows a live game's score and clock", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      showSpoilers: true,
    });
    expect(screen.getByText("Week 5 · Live")).toBeInTheDocument();
    expect(screen.getByText("Q4 - 08:21")).toBeInTheDocument();
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("13").length).toBeGreaterThan(0);
  });

  it("keeps a future game minimal: when and where, no score", () => {
    renderDetail({
      game: makeTeamGame(),
      now: KICKOFF_MS - PREGAME_WINDOW_MS - 60_000,
      showSpoilers: true,
    });

    expect(screen.getByText("at NO")).toBeInTheDocument();
    expect(screen.getByText("Fox")).toBeInTheDocument();
    expect(screen.getByText(/in /)).toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
    expect(screen.queryByText(/recap/i)).not.toBeInTheDocument();
  });

  it("surfaces a postponed game without inventing a phase", () => {
    renderDetail({ game: makeTeamGame({ status: "postponed" }) });
    expect(screen.getByText("postponed")).toBeInTheDocument();
  });
});

describe("GameDetail spoiler handling", () => {
  it("masks a finished game's score by default", () => {
    renderDetail();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
    expect(screen.queryByText("13")).not.toBeInTheDocument();
    expect(covered()).toHaveLength(2);
  });

  it("reveals a finished game's score when asked", () => {
    renderDetail({ showSpoilers: true });
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("sees a finished game to the end when its covered score is tapped", () => {
    renderDetail();
    const bars = screen.getAllByRole("button", { name: /^Reveal score/ });
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "Reveal score, MIN",
      "Reveal score, NO",
    ]);
    fireEvent.click(bars[0]!);
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(getWatchProgress()[finalGame.gameId]?.finished).toBe(true);
  });

  it("never says overtime about a hidden game under way", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: {
        ...liveScore,
        gameId: liveGame.gameId,
        detail: "10:00 - OT",
        period: 5,
        clock: "10:00",
      },
    });
    expect(screen.getByText("Q4+")).toBeInTheDocument();
    expect(screen.queryByText(/OT/)).not.toBeInTheDocument();
  });

  it("masks a live score by default", () => {
    renderDetail({ game: liveGame, now: KICKOFF_MS + 60_000 });
    expect(screen.queryByText("20")).not.toBeInTheDocument();
    expect(covered()).toHaveLength(2);
  });

  it("keeps both teams' marks visible while scores are hidden", () => {
    const { container } = renderDetail();
    const marks = [...container.querySelectorAll("img")].map((img) =>
      decodeURIComponent(img.getAttribute("src") ?? ""),
    );
    expect(marks.some((src) => src.includes("/min.png"))).toBe(true);
    expect(marks.some((src) => src.includes("/no.png"))).toBe(true);
  });

  it("hides a stale-score warning while scores are hidden", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      scoreError: "Score unavailable",
    });
    expect(screen.queryByText(/may be stale/)).not.toBeInTheDocument();
  });
});

describe("GameDetail live situation", () => {
  const live = { game: liveGame, now: KICKOFF_MS + 60_000 };

  it("shows down, distance, the last play and the drive", () => {
    renderDetail({
      ...live,
      score: liveScoreWithSituation,
      showSpoilers: true,
    });
    expect(screen.getByText("3rd & 4 at NO 18")).toBeInTheDocument();
    expect(screen.getByText("Red zone")).toBeInTheDocument();
    expect(screen.getByText(/J\.Jefferson for 6 yards/)).toBeInTheDocument();
    expect(screen.getByText("8 plays, 57 yards, 4:02")).toBeInTheDocument();
    expect(screen.getByLabelText("Has the ball")).toBeInTheDocument();
    expect(screen.getByLabelText("2 timeouts left")).toBeInTheDocument();
    expect(screen.getByLabelText("1 timeout left")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "MIN ball on NO 18, line to gain NO 14, drive began at MIN 25",
      }),
    ).toBeInTheDocument();
  });

  it("lists the away side first, matching the field's end zones", () => {
    renderDetail({
      ...live,
      score: liveScoreWithSituation,
      showSpoilers: true,
    });
    // MIN is away at NO: the score row's two sides, then its quarter grid,
    // then the end zones.
    const order = screen
      .getAllByText(/^(MIN|NO)$/)
      .map((element) => element.textContent);
    expect(order).toEqual(["MIN", "NO", "MIN", "NO", "MIN", "NO"]);
  });

  it("still draws the field when nobody has the ball", () => {
    renderDetail({
      ...live,
      score: {
        ...liveScoreWithSituation,
        situation: { ...liveScoreWithSituation.situation!, field: null },
      },
      showSpoilers: true,
    });
    expect(
      screen.getByRole("img", { name: "Field: nobody has the ball" }),
    ).toBeInTheDocument();
  });

  it("reveals none of it while spoilers are hidden", () => {
    renderDetail({ ...live, score: liveScoreWithSituation });
    expect(screen.queryByText("3rd & 4 at NO 18")).not.toBeInTheDocument();
    expect(screen.queryByText(/Jefferson/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Has the ball")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/timeouts? left/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /ball on|Field/ })).toBeNull();
  });

  it("ignores a situation from a different game", () => {
    renderDetail({
      ...live,
      score: { ...liveScoreWithSituation, gameId: "other" },
      showSpoilers: true,
    });
    expect(screen.queryByText("3rd & 4 at NO 18")).not.toBeInTheDocument();
  });
});

function snap(id: string, start: number, downDistance: string, text: string) {
  return {
    id,
    kind: "snap" as const,
    action: "run" as const,
    outcome: null,
    headline: `Play ${id}`,
    timeoutBy: null,
    text,
    period: 4,
    clock: "8:21",
    downDistance,
    down: Number(downDistance[0]),
    distance: 10,
    start,
    end: null,
    nextDown: null,
    scoring: false,
    turnover: false,
    penalty: false,
    score: { home: 13, away: 20 },
  };
}

/** MIN's drive under way at NO, ending where the situation has the ball. */
const playByPlay: PlayByPlay = {
  gameId: liveGame.gameId,
  drives: [
    {
      id: "1",
      offense: "home",
      description: "6 plays, 40 yards, 3:10",
      result: "Punt",
      isScore: false,
      inProgress: false,
      plays: [snap("10", 30, "4th & 3 at NO 30", "Punt by the Saints.")],
    },
    {
      id: "2",
      offense: "away",
      description: "8 plays, 57 yards, 4:02",
      result: null,
      isScore: false,
      inProgress: true,
      plays: [
        snap("20", 75, "1st & 10 at MIN 25", "A.Jones run for 20 yards."),
        snap("21", 55, "1st & 10 at MIN 45", "J.McCarthy pass to J.Addison."),
        snap("22", 24, "1st & 10 at NO 24", "J.Jefferson for 6 yards."),
      ],
    },
  ],
};

/** The scoreboard's word after the newest play, as a poll noted it. */
const situationAfter = (playId: string) =>
  playId === "22" ? liveScoreWithSituation.situation : null;

describe("GameDetail play-by-play", () => {
  const live = {
    game: liveGame,
    now: KICKOFF_MS + 60_000,
    score: liveScoreWithSituation,
    situationAfter,
  };

  it("lists drives newest first, the one under way open", () => {
    renderDetail({ ...live, playByPlay, showSpoilers: true });
    const feed = screen.getByRole("region", { name: "Play-by-play" });
    expect(feed).toHaveTextContent(/On the field.*Punt/);
    // Read newest first, the quarter is marked where it began: beneath it.
    expect(feed).toHaveTextContent(/Punt.*4th Quarter$/);
    expect(
      screen.getByRole("separator", { name: "4th Quarter begins" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A.Jones run for 20 yards.")).toBeVisible();
    expect(screen.getByText("1st & 10 at MIN 45")).toBeInTheDocument();
  });

  it("rules off each first down within a drive", () => {
    renderDetail({ ...live, playByPlay, showSpoilers: true });
    // Three first-and-tens in a row: two sets earned by the plays before them.
    expect(
      screen.getAllByRole("separator", { name: "First down" }),
    ).toHaveLength(2);
  });

  it("draws the set of downs from where it began to the ball", () => {
    renderDetail({ ...live, playByPlay, showSpoilers: true });
    const field = screen.getByRole("img", {
      name: /ball on NO 18.*set of downs began at NO 24/,
    });
    // One snap so far in this set: the 6-yard catch, from NO 24 to NO 18.
    expect(field.querySelectorAll("[data-step]")).toHaveLength(1);
  });

  it("leaves the last play to the feed rather than repeating it", () => {
    renderDetail({ ...live, playByPlay, showSpoilers: true });
    expect(
      screen.queryByText(/J\.Jefferson for 6 yards\./),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Jefferson/)).toHaveLength(1);
  });

  it("shows none of it while spoilers are hidden", () => {
    renderDetail({ ...live, playByPlay });
    expect(
      screen.queryByRole("region", { name: "Play-by-play" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/A\.Jones/)).not.toBeInTheDocument();
  });

  it("ignores plays from a different game", () => {
    renderDetail({
      ...live,
      playByPlay: { ...playByPlay, gameId: "other" },
      showSpoilers: true,
    });
    expect(
      screen.queryByRole("region", { name: "Play-by-play" }),
    ).not.toBeInTheDocument();
  });
});

describe("GameDetail score freshness", () => {
  it("says how old the live score is", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: { ...liveScore, gameId: liveGame.gameId },
      scoreUpdatedAt: KICKOFF_MS + 60_000 - 12_000,
    });
    expect(screen.getByText("Updated").parentElement).toHaveTextContent(
      /Updated\s*12s ago/,
    );
    // Nothing to press: the page asks ESPN on its own terms.
    expect(
      screen.queryByRole("button", { name: /Updated|Refresh/ }),
    ).not.toBeInTheDocument();
  });

  it("says nothing about freshness before a score for this game arrives", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: null,
      scoreUpdatedAt: KICKOFF_MS,
    });
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });
});

describe("GameDetail quarter grid", () => {
  const grid = () =>
    screen.queryByRole("table", { name: "Scoring by quarter" });
  const rowText = (name: string) =>
    [...(grid()?.querySelectorAll("tbody tr") ?? [])]
      .map((row) => row.textContent)
      .find((text) => text?.startsWith(name));

  it("shows each quarter of a live game, away side first", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: { ...liveScore, gameId: liveGame.gameId },
      showSpoilers: true,
    });
    expect(rowText("MIN")).toBe("MIN37010");
    expect(rowText("NO")).toBe("NO7330");
  });

  it("shows a finished game's quarters from the stored season", () => {
    renderDetail({
      game: makeTeamGame({
        status: "final",
        result: { teamScore: 23, opponentScore: 13, outcome: "win" },
        periods: { team: [7, 3, 6, 7], opponent: [0, 10, 0, 3] },
      }),
      showSpoilers: true,
    });
    expect(rowText("MIN")).toBe("MIN7367");
  });

  it("adds a column for overtime only once it is played", () => {
    renderDetail({
      game: makeTeamGame({
        status: "final",
        result: { teamScore: 27, opponentScore: 27, outcome: "tie" },
        periods: { team: [7, 7, 7, 6, 0], opponent: [0, 14, 7, 6, 0] },
      }),
      showSpoilers: true,
    });
    const headings = [...(grid()?.querySelectorAll("thead th") ?? [])].map(
      (cell) => cell.textContent,
    );
    expect(headings).toEqual(["Team", "1", "2", "3", "4", "OT"]);
  });

  it("is hidden with the rest of the result", () => {
    renderDetail({
      game: makeTeamGame({
        status: "final",
        result: { teamScore: 23, opponentScore: 13, outcome: "win" },
        periods: { team: [7, 3, 6, 7], opponent: [0, 10, 0, 3] },
      }),
    });
    expect(grid()).toBeNull();
  });
});

describe("GameDetail records", () => {
  const game = makeTeamGame({
    status: "final",
    result: { teamScore: 23, opponentScore: 13, outcome: "win" },
  });
  const records = {
    team: { wins: 5, losses: 0, ties: 0 },
    opponent: { wins: 1, losses: 3, ties: 1 },
  };

  it("shows each side's record under its label", () => {
    renderDetail({ game, showSpoilers: true, records });
    expect(screen.getByText("5-0")).toBeInTheDocument();
    expect(screen.getByText("1-3-1")).toBeInTheDocument();
  });

  it("shows none while they would give a result away", () => {
    renderDetail({ game, records: null });
    expect(screen.queryByText("5-0")).not.toBeInTheDocument();
    expect(screen.queryByText("1-3-1")).not.toBeInTheDocument();
  });

  it("gives a game to come the opponent's record beside its name", () => {
    renderDetail({
      game: makeTeamGame(),
      now: KICKOFF_MS - PREGAME_WINDOW_MS - 60_000,
      records,
    });
    expect(screen.getByText("1-3-1")).toBeInTheDocument();
  });
});

describe("GameDetail full screen", () => {
  it("offers no control unless the page can expand it", () => {
    renderDetail();
    expect(
      screen.queryByRole("button", { name: "Full screen" }),
    ).not.toBeInTheDocument();
  });

  it("toggles from every phase's panel", () => {
    const onToggleExpanded = vi.fn();
    for (const [game, now] of [
      [finalGame, AFTER_GAME_MS],
      [liveGame, KICKOFF_MS + 60_000],
      [makeTeamGame(), KICKOFF_MS - PREGAME_WINDOW_MS - 60_000],
    ] as const) {
      const { unmount } = renderDetail({ game, now, onToggleExpanded });
      fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
      unmount();
    }
    expect(onToggleExpanded).toHaveBeenCalledTimes(3);
  });

  it("offers the way back once expanded", () => {
    renderDetail({
      expanded: true,
      onToggleExpanded: () => {},
    });
    expect(
      screen.getByRole("button", { name: "Exit full screen" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("drops the kickoff details from a played game's panel", () => {
    for (const [game, now] of [
      [finalGame, AFTER_GAME_MS],
      [liveGame, KICKOFF_MS + 60_000],
    ] as const) {
      const { unmount } = renderDetail({
        game,
        now,
        expanded: true,
        onToggleExpanded: () => {},
      });
      expect(screen.queryByText("Kickoff")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("keeps them where they are all an upcoming game shows", () => {
    renderDetail({
      game: makeTeamGame(),
      now: KICKOFF_MS - PREGAME_WINDOW_MS - 60_000,
      expanded: true,
      onToggleExpanded: () => {},
    });
    expect(screen.getByText("Kickoff")).toBeInTheDocument();
  });
});

describe("GameDetail sideways", () => {
  const live = {
    game: liveGame,
    now: KICKOFF_MS + 60_000,
    score: liveScoreWithSituation,
    situationAfter,
    playByPlay,
    showSpoilers: true,
    records: {
      team: { wins: 5, losses: 0, ties: 0 },
      opponent: { wins: 1, losses: 3, ties: 1 },
    },
    sideways: true,
  };

  it("keeps the field, its controls and the feed", () => {
    renderDetail(live);
    expect(screen.getByRole("img", { name: /ball on NO 18/ })).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Play-by-play" }),
    ).toBeInTheDocument();
    expect(screen.getByText("A.Jones run for 20 yards.")).toBeVisible();
  });

  it("puts the score on one line: no records, quarters or kickoff", () => {
    const { unmount } = renderDetail({ ...live, sideways: false });
    expect(screen.getByText("5-0")).toBeInTheDocument();
    unmount();

    renderDetail(live);
    expect(screen.queryByText("5-0")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Scoring by quarter" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Kickoff")).not.toBeInTheDocument();
  });

  it("gives the field the width while nothing has been watched", () => {
    renderDetail({ ...live, showSpoilers: false, records: null });
    expect(
      screen.queryByRole("region", { name: "Play-by-play" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Watch from kickoff/ }),
    ).toBeInTheDocument();
  });
});

describe("GameDetail winner caret", () => {
  const finalGame = (teamScore: number, opponentScore: number) =>
    makeTeamGame({
      status: "final",
      result: {
        teamScore,
        opponentScore,
        outcome:
          teamScore > opponentScore
            ? "win"
            : teamScore < opponentScore
              ? "loss"
              : "tie",
      },
    });

  it("points at the side that won", () => {
    renderDetail({ game: finalGame(13, 23), showSpoilers: true });
    const winners = screen.getAllByText("Winner");
    expect(winners).toHaveLength(1);
    // The caret sits beside the winning figure, not the losing one.
    expect(winners[0]?.parentElement?.parentElement).toHaveTextContent(
      /^23Winner$/,
    );
  });

  it("points at the winner once the scoreboard calls a live game over", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: { ...liveScore, gameId: liveGame.gameId, completed: true },
      showSpoilers: true,
    });
    expect(screen.getAllByText("Winner")).toHaveLength(1);
  });

  it("waits for the scoreboard to call a live game over", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: { ...liveScore, gameId: liveGame.gameId, completed: false },
      showSpoilers: true,
    });
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });

  it("is absent for a tie", () => {
    renderDetail({ game: finalGame(20, 20), showSpoilers: true });
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });

  it("emphasizes neither side of a tie", () => {
    renderDetail({ game: finalGame(20, 20), showSpoilers: true });
    for (const figure of screen.getAllByText("20")) {
      expect(figure).toHaveClass("text-ink-muted");
    }
  });

  it("is hidden with the rest of the result", () => {
    renderDetail({ game: finalGame(23, 13), showSpoilers: false });
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });
});

describe("GameDetail finished game plays", () => {
  it("shows a finished game's play-by-play with spoilers on", () => {
    renderDetail({
      playByPlay: { ...playByPlay, gameId: finalGame.gameId },
      showSpoilers: true,
    });
    expect(
      screen.getByRole("region", { name: "Play-by-play" }),
    ).toBeInTheDocument();
  });

  it("hides it with the rest of the result", () => {
    renderDetail({
      playByPlay: { ...playByPlay, gameId: finalGame.gameId },
      showSpoilers: false,
    });
    expect(
      screen.queryByRole("region", { name: "Play-by-play" }),
    ).not.toBeInTheDocument();
  });
});

describe("GameDetail plays on the field", () => {
  // BAL at ATL stands in for MIN at NO: BAL's drives are MIN's.
  const final = {
    playByPlay: {
      gameId: finalGame.gameId,
      drives: extractPlayByPlay(SHORT_GAME),
    },
    showSpoilers: true,
  };
  const feed = () => screen.getByRole("region", { name: "Play-by-play" });
  // The field's yard numbers and each drive's score are figures too.
  const scoresShown = (value: string) =>
    screen
      .queryAllByText(value)
      .filter(
        (node) =>
          !node.closest("svg") &&
          !node.closest("table") &&
          !node.closest('[aria-label="Play-by-play"]'),
      );

  it("reads a finished game newest first too, the last drive open", () => {
    renderDetail(final);
    expect(feed()).toHaveTextContent(
      /2nd Quarter.*Punt.*Field Goal.*1st Quarter$/,
    );
    const details = feed().querySelectorAll("details");
    expect(details[0]).toHaveAttribute("open");
    expect(details[details.length - 1]).not.toHaveAttribute("open");
  });

  it("leaves each drive's score beside it, away side first", () => {
    renderDetail(final);
    // BAL's opening field goal, BAL standing in for MIN, away at NO.
    const opening = screen.getByText("Field Goal").closest("summary");
    expect(opening).toHaveTextContent(/MIN\s*3\s*NO\s*0/);
    expect(opening).not.toHaveTextContent(/^MIN/);
  });

  it("names the plays that change the game", () => {
    renderDetail(final);
    // BAL's field goal, ATL's punt, and the fumble ATL returned for a score.
    expect(feed()).toHaveTextContent(/Touchdown.*Turnover.*Punt.*Field goal/);
  });

  it("puts a picked play on the field", () => {
    renderDetail(final);
    expect(
      screen.getByRole("img", { name: "Field: nobody has the ball" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Field Goal"));
    const row = screen.getByRole("button", { name: /2nd & 5 at ATL 19/ });
    fireEvent.click(row);

    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", {
        name: /MIN ball on NO 19, line to gain NO 14, play ended at NO 8/,
      }),
    ).toBeInTheDocument();
  });

  it("steps with the arrow keys once a play is picked", () => {
    renderDetail(final);
    const picked = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((row) => row.textContent);

    // Nothing picked: the keys leave the game alone.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);

    fireEvent.click(screen.getByText("Field Goal"));
    fireEvent.click(
      screen.getByRole("button", { name: /4th & Goal at ATL 3/ }),
    );

    // Past the end of the drive, into the next.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(picked()).toEqual([expect.stringMatching(/P\.Boot kicks 58 yards/)]);
    // A frame at a time, as the buttons step: the next snap lines up first.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(picked()).toEqual([expect.stringMatching(/P\.Boot kicks 58 yards/)]);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(picked()).toEqual([expect.stringMatching(/1st & 10 at ATL 17/)]);

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(picked()).toEqual([expect.stringMatching(/4th & Goal at ATL 3/)]);

    // A browser chord is not a step.
    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true });
    expect(picked()).toEqual([expect.stringMatching(/4th & Goal at ATL 3/)]);
  });

  it("skips a drive at a time, by button or shifted arrow", () => {
    renderDetail(final);
    const picked = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((row) => row.textContent);
    fireEvent.click(screen.getByText("Field Goal"));
    fireEvent.click(screen.getByRole("button", { name: /1st & 10 at ATL 24/ }));

    // To the end of this drive, then the end of the next.
    fireEvent.click(screen.getByLabelText("On a drive"));
    expect(picked()).toEqual([expect.stringMatching(/4th & Goal at ATL 3/)]);
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(picked()).toEqual([expect.stringMatching(/K\.Archer punts 56/)]);

    // Back to where that drive began: the drive before's end.
    fireEvent.keyDown(window, { key: "ArrowLeft", shiftKey: true });
    expect(picked()).toEqual([expect.stringMatching(/4th & Goal at ATL 3/)]);
    fireEvent.click(screen.getByLabelText("Back a drive"));
    expect(picked()).toEqual([expect.stringMatching(/K\.Archer kicks 65/)]);
    expect(screen.getByLabelText("Back a drive")).toBeDisabled();
  });

  it("offers the game again from its end, in those words", () => {
    renderDetail(final);
    fireEvent.click(screen.getByText("Watch from kickoff"));
    fireEvent.click(screen.getByLabelText("Pause"));
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
    while (!(screen.getByLabelText("On a drive") as HTMLButtonElement).disabled)
      fireEvent.click(screen.getByLabelText("On a drive"));
    expect(screen.getByLabelText("Watch again")).toBeInTheDocument();
    // A stoppage reads in the feed's words, not ESPN's.
    expect(screen.getAllByText("End of 1st Quarter").length).toBeGreaterThan(0);
    expect(screen.queryByText("END QUARTER 1")).not.toBeInTheDocument();
  });

  it("watches a game a play at a time, scored as it stood", () => {
    renderDetail(final);
    expect(scoresShown("20")).toHaveLength(1);

    // Label queries: role queries over the full feed, all there once paused,
    // are slow enough to time out under a loaded runner.
    fireEvent.click(screen.getByText("Watch from kickoff"));
    expect(scoresShown("20")).toHaveLength(0);
    expect(scoresShown("0")).toHaveLength(2);
    // The grid and the timeouts as they stood at kickoff.
    const grid = screen.getByRole("table", { name: "Scoring by quarter" });
    expect(grid.querySelectorAll("tbody tr")[0]).toHaveTextContent(/^MIN0$/);
    expect(screen.getAllByLabelText("3 timeouts left")).toHaveLength(2);
    expect(screen.queryByText(/R\.Swift right end/)).not.toBeInTheDocument();
    expect(feed()).not.toHaveTextContent("Field Goal");

    fireEvent.click(screen.getByLabelText("Pause"));
    const forward = () =>
      fireEvent.click(screen.getByLabelText("Step forward"));

    // Paused, a game whose result is shown is all there to browse.
    expect(feed()).toHaveTextContent("Field Goal");

    // The first snap lined up: the ball on the line, the play not yet told.
    forward();
    expect(
      screen.getByText("MIN ball, 1st & 10 at BAL 35"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/^MIN ball on MIN 35, line to gain MIN 45$/),
    ).toBeInTheDocument();

    // Then played out, to where the next snap was spotted.
    forward();
    expect(screen.getAllByText(/R\.Swift right end/).length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/MIN ball on MIN 35.*play ended at MIN 48/),
    ).toBeInTheDocument();
    // Paused, the score stands with the field until the pick is cleared.
    const row = screen
      .getAllByText(/R\.Swift right end/)
      .map((node) => node.closest("button"))
      .find((button) => button !== null);
    fireEvent.click(row!);
    expect(scoresShown("20")).toHaveLength(1);
  });

  it("reads as final once the replay reaches the last play", () => {
    renderDetail(final);
    // The fixture's last drive, watched from its next-to-last play. Text and
    // label queries, since role queries over the full feed are slow enough to
    // time out under a loaded runner.
    fireEvent.click(screen.getByText("8 plays, 26 yards, 5:01"));
    fireEvent.click(screen.getByText("3rd & 3 at BAL 45"));
    fireEvent.click(screen.getByLabelText("Play"));
    fireEvent.click(screen.getByLabelText("Pause"));
    expect(screen.queryByText("Final")).not.toBeInTheDocument();

    const forward = screen.getByLabelText("Step forward");
    while (!forward.hasAttribute("disabled")) fireEvent.click(forward);
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  it("follows the live ball until a play is picked, then goes back", () => {
    renderDetail({
      game: liveGame,
      now: KICKOFF_MS + 60_000,
      score: liveScoreWithSituation,
      playByPlay,
      situationAfter,
      showSpoilers: true,
    });
    fireEvent.click(
      screen.getByRole("button", { name: /J\.McCarthy pass to J\.Addison/ }),
    );
    expect(
      screen.getByRole("img", {
        name: /MIN ball on MIN 45, line to gain NO 45, play ended at NO 24/,
      }),
    ).toBeInTheDocument();

    // Picking it again returns to the live ball.
    fireEvent.click(
      screen.getByRole("button", { name: /J\.McCarthy pass to J\.Addison/ }),
    );
    expect(
      screen.getByRole("img", { name: /ball on NO 18/ }),
    ).toBeInTheDocument();
  });
});

describe("GameDetail between plays", () => {
  const live = {
    game: liveGame,
    now: KICKOFF_MS + 60_000,
    score: liveScoreWithSituation,
    playByPlay,
  };
  // The 6-yard catch was respotted at the NO 12, a first down.
  const firstDown = {
    ...liveScoreWithSituation.situation!,
    downDistance: "1st & 10 at NO 12",
    timeouts: { team: 1, opponent: 3 },
    field: {
      offense: "away" as const,
      ballOn: 12,
      lineToGain: 2,
      driveSpots: [75, 12],
    },
  };

  it("follows a game under way when its result is shown, with no choice", () => {
    renderDetail({ ...live, situationAfter, showSpoilers: true });
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Watch from kickoff/ }),
    ).not.toBeInTheDocument();
    // The game as it stands, captioned and announced, its own clock between
    // the scores.
    expect(screen.getAllByText("3rd & 4 at NO 18")).toHaveLength(2);
    expect(screen.getByText("Q4 - 08:21")).toBeInTheDocument();
  });

  it("goes back to following once a play is picked", () => {
    renderDetail({ ...live, situationAfter, showSpoilers: true });
    // Already following: nowhere further to go.
    expect(
      screen.queryByRole("button", { name: "Watch live" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /J\.McCarthy pass to J\.Addison/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Watch live" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    // The live label does the same.
    fireEvent.click(
      screen.getByRole("button", { name: /J\.McCarthy pass to J\.Addison/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /live: watch from the newest play/ }),
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("rolls over to the next set, keeping the set that earned it", () => {
    recordWatchProgress(liveGame.gameId, { playId: "22", finished: false });
    renderDetail({
      ...live,
      situationAfter: (playId) => (playId === "22" ? firstDown : null),
    });
    expect(screen.getByText("1st & 10 at NO 12")).toBeInTheDocument();
    const field = screen.getByRole("img", {
      name: /^MIN ball on NO 12, line to gain NO 2, set of downs began at NO 24/,
    });
    // The catch that earned it stays until the next snap.
    expect(field.querySelectorAll("[data-step]")).toHaveLength(1);
    // Timeouts and the clock are the game's now, the clock told safely.
    expect(screen.getByLabelText("1 timeout left")).toBeInTheDocument();
    expect(screen.getByLabelText("3 timeouts left")).toBeInTheDocument();
    expect(screen.getByText("Q4+")).toBeInTheDocument();
    expect(screen.queryByText(/· Q4\+/)).not.toBeInTheDocument();
  });

  it("goes back to the play itself a step before", () => {
    recordWatchProgress(liveGame.gameId, { playId: "22", finished: false });
    renderDetail({
      ...live,
      situationAfter: (playId) => (playId === "22" ? firstDown : null),
    });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(
      screen.getByRole("img", {
        name: /^MIN ball on NO 24, line to gain NO 14/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("1st & 10 at NO 12")).not.toBeInTheDocument();
  });
});

describe("GameDetail watching with spoilers hidden", () => {
  // BAL at ATL stands in for MIN at NO: BAL's drives are MIN's.
  const drives = extractPlayByPlay(SHORT_GAME);
  const hidden = {
    playByPlay: { gameId: finalGame.gameId, drives },
    showSpoilers: false,
  };
  const feed = () => screen.queryByRole("region", { name: "Play-by-play" });
  const button = (name: string | RegExp) =>
    screen.getByRole("button", { name });
  const forward = () => fireEvent.click(button("Step forward"));
  const startWatching = () => {
    fireEvent.click(button(/Watch from kickoff/));
    fireEvent.click(button("Pause"));
  };

  it("asks for the plays only when the viewer starts watching, and starts on them", async () => {
    const onLoadPlays = vi.fn(async () => ({
      gameId: finalGame.gameId,
      drives,
    }));
    const { rerender } = render(
      <GameDetail
        game={finalGame}
        now={AFTER_GAME_MS}
        team={TEAMS.MIN}
        score={liveScore}
        scoreError={null}
        showSpoilers={false}
        recaps={makeRecaps()}
        onLoadPlays={onLoadPlays}
      />,
    );
    expect(feed()).not.toBeInTheDocument();
    expect(covered()).toHaveLength(2);
    fireEvent.click(button(/Watch from kickoff/));
    expect(onLoadPlays).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onLoadPlays.mock.results[0]?.value).resolves);
    rerender(
      <GameDetail
        game={finalGame}
        now={AFTER_GAME_MS}
        team={TEAMS.MIN}
        score={liveScore}
        scoreError={null}
        showSpoilers={false}
        recaps={makeRecaps()}
        playByPlay={{ gameId: finalGame.gameId, drives }}
      />,
    );
    // Running from kickoff: nothing seen yet, the transport is up.
    await waitFor(() => expect(button("Pause")).toBeInTheDocument());
    expect(covered()).toHaveLength(0);
  });

  it("offers the game from kickoff and shows none of it before then", () => {
    renderDetail(hidden);
    expect(feed()).not.toBeInTheDocument();
    expect(covered()).toHaveLength(2);
    expect(
      screen.getByRole("img", { name: "Field: nobody has the ball" }),
    ).toBeInTheDocument();
    expect(button(/Watch from kickoff/)).toBeInTheDocument();
  });

  it("reveals each play as it is reached, scored as it stood", () => {
    renderDetail(hidden);
    startWatching();
    expect(covered()).toHaveLength(0);
    expect(screen.queryByText(/R\.Swift right end/)).not.toBeInTheDocument();

    forward();
    forward();
    expect(feed()).toHaveTextContent(/R\.Swift right end.*K\.Archer kicks/);
    expect(feed()).not.toHaveTextContent("Field Goal");
  });

  it("keeps what was watched when paused, and nothing past it", () => {
    const { unmount } = renderDetail(hidden);
    startWatching();
    forward();
    forward();
    // Paused with the next snap lined up: that play stays untold.
    forward();

    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    expect(feed()).not.toHaveTextContent("Field Goal");
    expect(covered()).toHaveLength(0);
    unmount();

    // Back later, the field rests at the place, and steps back from it.
    renderDetail(hidden);
    expect(
      screen.getByRole("img", { name: /play ended at MIN 48/ }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(button(/K\.Archer kicks/)).toHaveAttribute("aria-pressed", "true");
  });

  it("unsees nothing stepped back over, though the feed goes back too", () => {
    renderDetail(hidden);
    startWatching();
    forward();
    forward();
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    const place = getWatchProgress()[finalGame.gameId]?.playId;

    fireEvent.click(button("Step back"));
    fireEvent.click(button("Step back"));
    // The feed stands at the play on the field; the place stays.
    expect(feed()).not.toHaveTextContent(/R\.Swift right end/);
    expect(feed()).toHaveTextContent(/K\.Archer kicks 65 yards/);
    expect(getWatchProgress()[finalGame.gameId]?.playId).toBe(place);

    forward();
    forward();
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    expect(feed()).not.toHaveTextContent("Field Goal");
  });

  it("keeps the place when watched again from kickoff", () => {
    const { unmount } = renderDetail(hidden);
    startWatching();
    forward();
    forward();
    unmount();
    const again = renderDetail(hidden);
    fireEvent.click(button(/From kickoff/));
    fireEvent.click(button("Pause"));
    again.unmount();

    renderDetail(hidden);
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    expect(feed()).not.toHaveTextContent("Field Goal");
  });

  it("says the game is over beside where the viewer is in it", () => {
    // With the result shown, the label says so only once the row stands at
    // a play; hidden, it is the way to the end from the start.
    renderDetail({ ...hidden, showSpoilers: true });
    expect(screen.queryByText(/· Final/)).not.toBeInTheDocument();
    startWatching();
    forward();
    forward();
    expect(screen.getByText(/· Final/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /see the game to the end/ }),
    ).not.toBeInTheDocument();
  });

  it("sees the game to the end from the Final label", () => {
    renderDetail(hidden);
    expect(button(/final: see the game to the end/)).toBeInTheDocument();
    startWatching();
    forward();
    forward();
    expect(covered()).toHaveLength(0);

    fireEvent.click(button(/final: see the game to the end/));
    expect(getWatchProgress()[finalGame.gameId]?.finished).toBe(true);
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(feed()).toHaveTextContent("Field Goal");
    expect(
      screen.queryByRole("button", { name: /see the game to the end/ }),
    ).not.toBeInTheDocument();
  });

  it("picks up where the viewer left off", () => {
    const { unmount } = renderDetail(hidden);
    startWatching();
    forward();
    forward();
    unmount();

    renderDetail(hidden);
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    expect(feed()).not.toHaveTextContent("Field Goal");

    fireEvent.click(button("Resume"));
    fireEvent.click(button("Pause"));
    // The next snap, lined up and not yet told.
    expect(screen.getByText(/^MIN ball, \d/)).toBeInTheDocument();
    expect(button("Step back")).not.toBeDisabled();
  });

  it("reads as final once watched to the end, and stays so", () => {
    const last = playsInOrder(drives).at(-1);
    if (!last) throw new Error("The fixture has plays");
    recordWatchProgress(finalGame.gameId, {
      playId: last.id,
      finished: true,
    });

    renderDetail(hidden);
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(covered()).toHaveLength(0);
    // Watched to the end, so all of it is there.
    expect(feed()).toHaveTextContent(/Field Goal.*1st Quarter/);

    // Watching again from the start finishes nothing over.
    startWatching();
    expect(getWatchProgress()[finalGame.gameId]?.finished).toBe(true);
    expect(covered()).toHaveLength(0);
  });

  it("forgets nothing when spoilers are turned on and off again", () => {
    const { rerender } = renderDetail(hidden);
    startWatching();
    forward();
    forward();

    const props = {
      game: finalGame,
      now: AFTER_GAME_MS,
      team: TEAMS.MIN,
      score: liveScore,
      scoreError: null,
      recaps: makeRecaps(),
      ...hidden,
    };
    rerender(<GameDetail {...props} showSpoilers />);
    expect(feed()).toHaveTextContent("Field Goal");
    rerender(<GameDetail {...props} />);
    expect(feed()).not.toHaveTextContent("Field Goal");
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
  });

  it("counts a play picked with spoilers shown as seen once they are hidden", () => {
    const props = {
      game: finalGame,
      now: AFTER_GAME_MS,
      team: TEAMS.MIN,
      score: liveScore,
      scoreError: null,
      recaps: makeRecaps(),
      ...hidden,
    };
    const { rerender } = render(<GameDetail {...props} showSpoilers />);
    fireEvent.click(screen.getByText("Field Goal"));
    fireEvent.click(button(/4th & Goal at ATL 3/));

    rerender(<GameDetail {...props} />);
    expect(covered()).toHaveLength(0);
    expect(feed()).toHaveTextContent(/4th & Goal at ATL 3/);
    expect(feed()).not.toHaveTextContent("Punt");
  });
});

describe("GameDetail following a live game with spoilers hidden", () => {
  // BAL at ATL stands in for MIN at NO: BAL's drives are MIN's.
  const drives = extractPlayByPlay(SHORT_GAME);
  const plays = playsInOrder(drives);
  const live = {
    game: liveGame,
    now: KICKOFF_MS + 60_000,
    score: liveScoreWithSituation,
    playByPlay: { gameId: liveGame.gameId, drives },
    showSpoilers: false,
  };
  const feed = () => screen.queryByRole("region", { name: "Play-by-play" });
  const button = (name: string | RegExp) =>
    screen.getByRole("button", { name });
  const last = plays.at(-1);
  if (!last) throw new Error("The fixture has plays");

  it("joins at the newest play when the covered score is tapped", () => {
    renderDetail(live);
    expect(feed()).not.toBeInTheDocument();
    fireEvent.click(button("Reveal score, MIN"));

    expect(covered()).toHaveLength(0);
    expect(feed()).toHaveTextContent("Field Goal");
    // Following, so the place is the newest play.
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id);
    // Not over yet: the game is still going.
    expect(getWatchProgress()[liveGame.gameId]?.finished).toBe(false);
  });

  it("offers to watch live beside watching from kickoff", () => {
    renderDetail(live);
    expect(button(/Watch from kickoff/)).toBeInTheDocument();
    fireEvent.click(button("Watch live"));

    expect(covered()).toHaveLength(0);
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id);
    // Following now, there is nowhere further to go.
    expect(
      screen.queryByRole("button", { name: "Watch live" }),
    ).not.toBeInTheDocument();
  });

  it("asks for the plays to watch live, and starts at the newest", async () => {
    const loaded = { gameId: liveGame.gameId, drives };
    const onLoadPlays = vi.fn(async () => loaded);
    const { rerender } = renderDetail({
      ...live,
      playByPlay: null,
      onLoadPlays,
    });
    fireEvent.click(button("Watch live"));
    expect(onLoadPlays).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onLoadPlays.mock.results[0]?.value).resolves);
    rerender(
      <GameDetail
        {...live}
        team={TEAMS.MIN}
        scoreError={null}
        recaps={makeRecaps()}
        playByPlay={loaded}
      />,
    );
    await waitFor(() =>
      expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id),
    );
  });

  it("offers to watch live from partway, but not from the newest play", () => {
    recordWatchProgress(liveGame.gameId, {
      playId: plays[0]!.id,
      finished: false,
    });
    const { unmount } = renderDetail(live);
    expect(button("Resume")).toBeInTheDocument();
    fireEvent.click(button("Watch live"));
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id);
    unmount();

    renderDetail(live);
    expect(button("Resume")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Watch live" }),
    ).not.toBeInTheDocument();
  });

  it("offers the way to live from the controls while behind", () => {
    renderDetail(live);
    fireEvent.click(button(/Watch from kickoff/));
    fireEvent.click(button("Watch live"));
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id);
    expect(
      screen.queryByRole("button", { name: /^Speed/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the place when paused, to catch up from later", () => {
    const { unmount } = renderDetail(live);
    fireEvent.click(button(/Watch from kickoff/));
    fireEvent.click(button("Pause"));
    fireEvent.click(button("Step forward"));
    fireEvent.click(button("Step forward"));
    unmount();

    renderDetail(live);
    expect(feed()).toHaveTextContent(/R\.Swift right end/);
    expect(feed()).not.toHaveTextContent("Field Goal");
    expect(button("Resume")).toBeInTheDocument();
  });

  it("jumps from the viewer's place to the newest play from the live label", () => {
    recordWatchProgress(liveGame.gameId, {
      playId: plays[0]!.id,
      finished: false,
    });
    renderDetail(live);
    expect(feed()).not.toHaveTextContent("Field Goal");

    fireEvent.click(button(/live: watch from the newest play/));
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(last.id);
  });

  it("offers no speed once caught up, and does while behind", () => {
    const { unmount } = renderDetail(live);
    fireEvent.click(button("Reveal score, MIN"));
    expect(
      screen.queryByRole("button", { name: /^Speed/ }),
    ).not.toBeInTheDocument();
    unmount();

    renderDetail(live);
    fireEvent.click(button(/From kickoff/));
    expect(button("Speed 1×")).toBeInTheDocument();
  });

  it("gives the game's own clock beside where the viewer is in it", () => {
    recordWatchProgress(liveGame.gameId, {
      playId: plays[0]!.id,
      finished: false,
    });
    renderDetail(live);
    // The viewer is at kickoff; the game is in the fourth, told safely.
    expect(screen.getByText(/· Q4\+/)).toBeInTheDocument();
  });

  it("offers no jump once the result is shown", () => {
    renderDetail({ ...live, showSpoilers: true });
    expect(
      screen.queryByRole("button", { name: /watch from the newest play/ }),
    ).not.toBeInTheDocument();
  });

  it("is seen to the end once followed through the last play of a game now over", () => {
    recordWatchProgress(liveGame.gameId, {
      playId: last.id,
      finished: false,
    });
    renderDetail({
      ...live,
      game: finalGame,
      now: AFTER_GAME_MS,
      playByPlay: { gameId: finalGame.gameId, drives },
    });
    expect(getWatchProgress()[liveGame.gameId]?.finished).toBe(true);
    expect(screen.getByText("Final")).toBeInTheDocument();
  });
});

describe("GameDetail held back to match a broadcast", () => {
  const drives = extractPlayByPlay(SHORT_GAME);
  const plays = playsInOrder(drives);
  const live = {
    game: liveGame,
    now: KICKOFF_MS + 60_000,
    score: liveScoreWithSituation,
    playByPlay: { gameId: liveGame.gameId, drives },
    showSpoilers: false,
  };
  const delayBy = (seconds: number) => {
    for (let step = 0; step < seconds / 10; step += 1) {
      cycleBroadcastDelay(liveGame.gameId);
    }
  };

  it("offers a delay in place of speed once caught up", () => {
    renderDetail(live);
    fireEvent.click(screen.getByRole("button", { name: "Reveal score, MIN" }));
    const delay = screen.getByRole("button", { name: "Delay 0s" });
    expect(delay).toHaveTextContent("+0s");
    expect(delay).toHaveAttribute("title", "Add 10s delay");
    fireEvent.click(delay);
    expect(screen.getByRole("button", { name: "Delay 10s" })).toHaveTextContent(
      "+10s",
    );
  });

  it("holds a play back until the delay has passed since it arrived", () => {
    // The last drive arrives now; the rest were there from the first load.
    const last = drives.find((drive) =>
      drive.plays.some((play) => play.id === plays.at(-1)!.id),
    );
    notePlayArrivals(
      liveGame.gameId,
      drives.filter((drive) => drive !== last),
      0,
    );
    notePlayArrivals(liveGame.gameId, drives, Date.now());
    delayBy(30);

    renderDetail(live);
    fireEvent.click(screen.getByRole("button", { name: "Reveal score, MIN" }));
    const lastHeard = plays
      .filter((play) => !last!.plays.includes(play))
      .at(-1);
    expect(getWatchProgress()[liveGame.gameId]?.playId).toBe(lastHeard!.id);
  });

  it("keeps a game live until the delayed broadcast reaches its end", () => {
    const clock = {
      detail: "0:40 - 4th",
      period: 4,
      clock: "0:40",
      completed: false,
    };
    noteGameClock(finalGame.gameId, clock, Date.now() - 60_000);
    noteGameClock(
      finalGame.gameId,
      { ...clock, detail: "Final", clock: "0:00", completed: true },
      Date.now(),
    );
    for (let step = 0; step < 3; step += 1) {
      cycleBroadcastDelay(finalGame.gameId);
    }

    renderDetail({ now: Date.now() });
    expect(screen.getByText(/· Live/)).toBeInTheDocument();
    expect(screen.queryByText("Final")).not.toBeInTheDocument();
  });
});
