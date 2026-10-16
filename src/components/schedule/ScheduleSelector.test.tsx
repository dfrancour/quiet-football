import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSelector } from "~/components/schedule/ScheduleSelector";
import {
  TEAMS,
  makeTeamGame,
  makeTeamSchedule,
} from "~/lib/test-utils/fixtures";
import { recordWatchProgress } from "~/lib/watch-progress";

const KICKOFF = "2026-10-11T17:00:00.000Z";
const KICKOFF_MS = Date.parse(KICKOFF);

/** Uses the component's own options, so it is locale-agnostic. */
const EXPECTED_DATE = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date(KICKOFF));

const finalGame = makeTeamGame({
  gameId: "played",
  week: 5,
  status: "final",
  result: { teamScore: 20, opponentScore: 13, outcome: "win" },
});

// A distinct opponent keeps each row's matchup text unique in queries.
const futureGame = makeTeamGame({
  gameId: "future",
  week: 7,
  kickoff: "2026-10-25T17:00:00.000Z",
  homeAway: "home",
  opponent: TEAMS.CHI,
});

function renderSelector(
  overrides: Partial<React.ComponentProps<typeof ScheduleSelector>> = {},
) {
  const onSelect = vi.fn();
  const result = render(
    <ScheduleSelector
      schedule={makeTeamSchedule([finalGame, futureGame])}
      selectedGameId="played"
      onSelect={onSelect}
      isShown={() => false}
      now={KICKOFF_MS + 5 * 24 * 60 * 60 * 1000}
      {...overrides}
    />,
  );
  return { ...result, onSelect };
}

describe("ScheduleSelector dates", () => {
  it("shows the date with spoilers hidden", () => {
    renderSelector();
    expect(screen.getByText(EXPECTED_DATE)).toBeInTheDocument();
  });

  it("still shows the date with spoilers shown", () => {
    renderSelector({ isShown: () => true });
    expect(screen.getByText(EXPECTED_DATE)).toBeInTheDocument();
  });
});

describe("ScheduleSelector results", () => {
  it("withholds the score and shows only Final by default", () => {
    renderSelector();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.queryByText("W 20-13")).not.toBeInTheDocument();
  });

  it("shows the score once spoilers are on or the game is uncovered", () => {
    renderSelector({ isShown: (game) => game.gameId === "played" });
    expect(screen.getByText("W 20-13")).toBeInTheDocument();
    expect(screen.queryByText("Final")).not.toBeInTheDocument();
  });

  it("marks a game under way as live regardless of the spoiler switch", () => {
    const liveGame = makeTeamGame({ gameId: "live", status: "in_progress" });
    renderSelector({
      schedule: makeTeamSchedule([liveGame]),
      now: KICKOFF_MS + 60_000,
    });
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("leaves a future game with no result column", () => {
    renderSelector();
    expect(screen.queryByText("T 0-0")).not.toBeInTheDocument();
    // The future row carries its date and nothing resembling a result.
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("ScheduleSelector navigation", () => {
  it("reports the picked game", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSelector();

    await user.click(screen.getByText("at NO", { selector: "span" }));
    expect(onSelect).toHaveBeenCalled();
  });

  it("marks the selected row for assistive tech", () => {
    renderSelector();
    const current = screen
      .getAllByRole("button")
      .filter((node) => node.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
  });

  it("renders a bye week as plain text, not a choice", () => {
    renderSelector({
      schedule: makeTeamSchedule([finalGame], { byeWeeks: [6] }),
    });
    expect(screen.getByText("Bye")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("ScheduleSelector team marks", () => {
  it("carries each row's opponent mark with spoilers hidden", () => {
    const { container } = renderSelector();
    const marks = [...container.querySelectorAll("img")].map((img) =>
      decodeURIComponent(img.getAttribute("src") ?? ""),
    );
    expect(marks.some((src) => src.includes("/no.png"))).toBe(true);
    expect(marks.some((src) => src.includes("/chi.png"))).toBe(true);
  });
});

describe("ScheduleSelector watched games", () => {
  it("says Final, not how far the viewer watched", () => {
    recordWatchProgress("played", {
      playId: "1",
      finished: false,
    });
    renderSelector();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.queryByText("W 20-13")).not.toBeInTheDocument();
  });
});
