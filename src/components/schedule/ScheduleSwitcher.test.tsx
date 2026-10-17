import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSwitcher } from "~/components/schedule/ScheduleSwitcher";
import {
  TEAMS,
  makeTeamGame,
  makeTeamSchedule,
} from "~/lib/test-utils/fixtures";

const played = makeTeamGame({
  gameId: "played",
  week: 5,
  status: "final",
  result: { teamScore: 20, opponentScore: 13, outcome: "win" },
});
const next = makeTeamGame({
  gameId: "next",
  week: 7,
  kickoff: "2026-10-25T17:00:00.000Z",
  homeAway: "home",
  opponent: TEAMS.CHI,
});
const NOW = Date.parse("2026-10-16T17:00:00.000Z");

function renderSwitcher(selected = played) {
  const onSelect = vi.fn();
  render(
    <ScheduleSwitcher
      schedule={makeTeamSchedule([played, next])}
      selectedGame={selected}
      selectedBye={null}
      onSelectBye={() => undefined}
      onSelect={onSelect}
      isShown={() => false}
      now={NOW}
    />,
  );
  return onSelect;
}

describe("ScheduleSwitcher", () => {
  it("names the selected game and keeps the schedule shut", () => {
    renderSwitcher();
    expect(
      screen.getByRole("button", { name: /Week 5.*at NO/, expanded: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the schedule, and picking a game selects it and closes", async () => {
    const user = userEvent.setup();
    const onSelect = renderSwitcher();
    await user.click(screen.getByRole("button", { name: /Week 5/ }));
    const sheet = screen.getByRole("dialog");
    expect(sheet).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: /vs CHI/ }));
    expect(onSelect).toHaveBeenCalledWith("next");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and on its close control", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: /Week 5/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Week 5/ })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /Week 5/ }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
