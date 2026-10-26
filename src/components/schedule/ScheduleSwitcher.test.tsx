import { cleanup, render, screen, within } from "@testing-library/react";
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

function renderSwitcher(
  selected: typeof played | null = played,
  bye: number | null = null,
) {
  const onSelect = vi.fn();
  const onSelectBye = vi.fn();
  render(
    <ScheduleSwitcher
      schedule={makeTeamSchedule([played, next])}
      selectedGame={selected}
      selectedBye={bye}
      onSelectBye={onSelectBye}
      onSelect={onSelect}
      isShown={() => false}
      now={NOW}
    />,
  );
  return Object.assign(onSelect, { onSelectBye });
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
    // Over the page, not laid out in the bar, which moves as the page scrolls.
    expect(sheet.parentElement?.parentElement).toBe(document.body);

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

  it("keeps Tab within the open schedule", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: /Week 5/ }));
    const sheet = screen.getByRole("dialog");
    const inSheet = within(sheet).getAllByRole("button");
    const first = inSheet[0];
    const last = inSheet.at(-1);
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("steps a week either way through the schedule, byes included", async () => {
    const user = userEvent.setup();
    const step = (name: string) => screen.getByRole("button", { name });

    const fromPlayed = renderSwitcher();
    expect(step("Previous week")).toBeDisabled();
    await user.click(step("Next week"));
    expect(fromPlayed.onSelectBye).toHaveBeenCalledWith(6);
    cleanup();

    const fromBye = renderSwitcher(null, 6);
    expect(
      screen.getByRole("button", { name: /Week 6.*Bye/, expanded: false }),
    ).toBeInTheDocument();
    await user.click(step("Next week"));
    expect(fromBye).toHaveBeenCalledWith("next");
    await user.click(step("Previous week"));
    expect(fromBye).toHaveBeenCalledWith("played");
    cleanup();

    renderSwitcher(next);
    expect(step("Next week")).toBeDisabled();
  });
});
