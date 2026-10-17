import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaughtUp } from "~/components/common/CaughtUp";

/** A phone: no media query matches. */
function narrow() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => vi.unstubAllGlobals());

function renderControl(
  through = 3,
  partial: { week: number; uncovered: boolean } | null = null,
) {
  const onCatchUp = vi.fn();
  render(
    <CaughtUp
      through={through}
      settledThrough={7}
      currentWeek={8}
      totalWeeks={18}
      partial={partial}
      onCatchUp={onCatchUp}
    />,
  );
  return onCatchUp;
}

describe("CaughtUp on a phone", () => {
  it("opens the strip as a sheet and closes on a pick, focus back on the control", async () => {
    narrow();
    const user = userEvent.setup();
    const onCatchUp = renderControl();
    const control = screen.getByRole("button", { name: "Through Week 3" });
    expect(control).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(control);
    const sheet = screen.getByRole("dialog", { name: "Spoilers" });
    expect(sheet).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(
      within(sheet).getByRole("button", { name: "Through Week 5" }),
    );
    expect(onCatchUp).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(control).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape without choosing", async () => {
    narrow();
    const user = userEvent.setup();
    const onCatchUp = renderControl();
    await user.click(screen.getByRole("button", { name: "Through Week 3" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCatchUp).not.toHaveBeenCalled();
  });
});

describe("CaughtUp with room", () => {
  it("opens the strip as a popover, with no dialog", async () => {
    const user = userEvent.setup();
    renderControl();
    await user.click(screen.getByRole("button", { name: "Through Week 3" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Caught up through" }),
    ).toBeInTheDocument();
  });
});

describe("CaughtUp with a week in progress", () => {
  it("offers the week as half a cell, with its finished games to take", async () => {
    const user = userEvent.setup();
    const onCatchUp = renderControl(7, { week: 8, uncovered: false });
    await user.click(screen.getByRole("button", { name: "Through Week 7" }));
    const half = screen.getByRole("button", { name: "Week 8 so far" });
    expect(half).toBeEnabled();
    expect(half).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Through Week 9" }),
    ).toBeDisabled();

    await user.hover(half);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Catch up through Week 8 so far",
    );
    await user.click(half);
    expect(onCatchUp).toHaveBeenCalledWith(8);
  });

  it("names the week so far once caught up into it, and offers nothing further", async () => {
    const user = userEvent.setup();
    const onCatchUp = renderControl(7, { week: 8, uncovered: true });
    await user.click(screen.getByRole("button", { name: "Week 8 so far" }));
    expect(
      screen.getByRole("button", { name: "Week 8 so far", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Caught up through Week 8 so far",
    );
    expect(
      screen.queryByRole("button", { name: /^Catch up through/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Week 8 so far", pressed: true }),
    );
    expect(onCatchUp).not.toHaveBeenCalled();
  });

  it("leads the shortcut to the week in progress", async () => {
    const user = userEvent.setup();
    const onCatchUp = renderControl(3, { week: 8, uncovered: false });
    await user.click(screen.getByRole("button", { name: "Through Week 3" }));
    await user.click(
      screen.getByRole("button", { name: "Catch up through Week 8 so far" }),
    );
    expect(onCatchUp).toHaveBeenCalledWith(8);
  });
});
