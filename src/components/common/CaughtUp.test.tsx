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

function renderControl(through = 3) {
  const onCatchUp = vi.fn();
  render(
    <CaughtUp
      through={through}
      settledThrough={7}
      currentWeek={8}
      totalWeeks={18}
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
