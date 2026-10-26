import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "~/components/layout/AppHeader";
import { SiteHeader } from "~/components/layout/SiteHeader";
import { markIntroduced, resetIntroducedCache } from "~/lib/first-run";
import { TEAMS } from "~/lib/test-utils/fixtures";

// A viewer who has seen the strip, so it waits to be opened.
beforeEach(() => markIntroduced());
afterEach(() => {
  window.localStorage.clear();
  resetIntroducedCache();
});

const home = () => screen.getByRole("link", { name: "Quiet Football" });

describe("SiteHeader", () => {
  /** The header under a page that catches up as the viewer picks. */
  const renderSite = (initial: number, settledThrough: number) => {
    const onCatchUp = vi.fn();
    function Page() {
      const [through, setThrough] = useState(initial);
      return (
        <SiteHeader
          through={through}
          showAll={false}
          onShowAll={() => undefined}
          settledThrough={settledThrough}
          currentWeek={settledThrough + 1}
          totalWeeks={18}
          partial={null}
          onCatchUp={(week) => {
            onCatchUp(week);
            setThrough(week);
          }}
        />
      );
    }
    render(<Page />);
    return onCatchUp;
  };

  const open = () =>
    fireEvent.click(screen.getByRole("button", { expanded: false }));

  it("leads home from the site's name, with spoilers at the right", () => {
    renderSite(0, 7);
    expect(home()).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("button", { name: "Spoilers hidden" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("opens the season, filled through the week caught up through", () => {
    renderSite(7, 9);
    open();
    const strip = screen.getByRole("group", { name: "Caught up through" });
    const week = (n: number) =>
      within(strip).getByRole("button", { name: `Through Week ${n}` });
    expect(week(7)).toHaveAttribute("aria-pressed", "true");
    expect(week(7)).toHaveClass("bg-accent-dim");
    expect(week(8)).not.toHaveClass("bg-accent-dim");
    expect(week(10)).toHaveAttribute("title", "This week");
    // Hovering previews the fill.
    fireEvent.pointerEnter(week(9));
    expect(week(8)).toHaveClass("bg-accent-dim");
  });

  it("catches up through any settled week, and no further", () => {
    const onCatchUp = renderSite(7, 9);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Through Week 3" }));
    expect(onCatchUp).toHaveBeenCalledWith(3);
    // It stays open, showing the pick.
    expect(
      screen.getByRole("button", { name: "Through Week 3", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Through Week 10" }),
    ).toBeDisabled();
    // The covers sweep from the old place, each a step after the one before.
    const cover = (n: number) =>
      screen
        .getByRole("button", { name: `Through Week ${n}` })
        .querySelector<HTMLElement>(".hatched");
    expect(cover(6)?.style.transitionDelay).toBe("18ms");
    expect(cover(4)?.style.transitionDelay).toBe("54ms");
  });

  it("says where a hovered week would leave the viewer", () => {
    renderSite(7, 9);
    open();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Caught up through Week 7",
    );
    fireEvent.pointerEnter(
      screen.getByRole("button", { name: "Through Week 9" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Catch up through Week 9",
    );
    fireEvent.pointerEnter(
      screen.getByRole("button", { name: "Through Week 5" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Go back to Week 5");
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Hide all" }));
    expect(screen.getByRole("status")).toHaveTextContent("Hide all spoilers");
  });

  it("catches up to the last settled week in one tap, when behind", () => {
    const onCatchUp = renderSite(7, 9);
    open();
    fireEvent.click(
      screen.getByRole("button", { name: /Catch up through Week 9/ }),
    );
    expect(onCatchUp).toHaveBeenCalledWith(9);
    expect(
      screen.queryByRole("button", { name: /Catch up through/ }),
    ).not.toBeInTheDocument();
  });

  it("hides everything again", () => {
    const onCatchUp = renderSite(7, 9);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Hide all" }));
    expect(onCatchUp).toHaveBeenCalledWith(0);
  });

  it("adds the playoff rounds once the regular season is settled", () => {
    renderSite(0, 17);
    open();
    expect(
      screen.queryByRole("button", { name: "Through Wild Card" }),
    ).not.toBeInTheDocument();
    cleanup();
    renderSite(18, 19);
    open();
    expect(
      screen.getByRole("button", { name: "Through Wild Card" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Through Divisional Round" }),
    ).toBeDisabled();
  });

  it("carries a team page's team after the site's name", () => {
    render(
      <AppHeader
        team={TEAMS.MIN}
        record={{ wins: 4, losses: 1, ties: 0 }}
        through={5}
        showAll={false}
        onShowAll={() => undefined}
        settledThrough={5}
        currentWeek={6}
        totalWeeks={18}
        partial={null}
        onCatchUp={() => undefined}
      />,
    );
    expect(home()).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("heading", { name: TEAMS.MIN.displayName }),
    ).toBeInTheDocument();
    expect(screen.getByText("4-1")).toBeInTheDocument();
  });
});
