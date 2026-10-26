import { onlineManager } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadFailed, Loading, Supported } from "~/components/common/LoadState";
import { WeekLoadError } from "~/hooks/useLeague";
import { queryWrapper } from "~/lib/test-utils/query";
import { UpstreamError } from "~/lib/upstream";

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Loading", () => {
  it("keeps the site's header, so the frame holds still when the season comes", () => {
    render(<Loading />, { wrapper: queryWrapper() });
    expect(
      screen.getByRole("link", { name: "Quiet Football" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("says what it is waiting on only once the wait is long", () => {
    vi.useFakeTimers();
    render(<Loading />, { wrapper: queryWrapper() });
    expect(screen.queryByText(/still waiting/i)).toBeNull();
    act(() => vi.advanceTimersByTime(4_000));
    expect(
      screen.getByText(/still loading the games and standings/i),
    ).toBeInTheDocument();
  });

  it("says, in the page as built, why the season would never come", () => {
    const Wrapper = queryWrapper();
    const html = renderToStaticMarkup(
      <Wrapper>
        <Loading />
      </Wrapper>,
    );
    expect(html).toMatch(
      /<noscript>.*This page requires JavaScript to be enabled\..*<\/noscript>/,
    );
    expect(html).toContain(
      '<p data-too-old="true" style="display:none" class="text-ink-muted text-sm">This browser is too old to show the season.</p>',
    );
  });

  it("says the browser is offline", () => {
    render(<Loading />, { wrapper: queryWrapper() });
    act(() => onlineManager.setOnline(false));
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });
});

describe("LoadFailed", () => {
  it("names the week and puts the cause in the viewer's terms", () => {
    render(
      <LoadFailed
        error={new WeekLoadError("Week 7", new TypeError("Failed to fetch"))}
      />,
      { wrapper: queryWrapper() },
    );
    expect(screen.getByText(/Week 7 could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/)).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });

  it("names ESPN's status for the season as a whole", () => {
    render(
      <LoadFailed
        error={new UpstreamError("site.api.espn.com responded 503", 503)}
      />,
      { wrapper: queryWrapper() },
    );
    expect(
      screen.getByText(/The season could not be loaded/),
    ).toBeInTheDocument();
    expect(screen.getByText(/responded 503/)).toBeInTheDocument();
  });
});

describe("Supported", () => {
  it("draws the page in a browser that can draw the site", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    render(<Supported>the season</Supported>, { wrapper: queryWrapper() });
    expect(screen.getByText("the season")).toBeInTheDocument();
  });

  it("says a browser is too old to draw it, in place of the page", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    render(<Supported>the season</Supported>, { wrapper: queryWrapper() });
    expect(screen.queryByText("the season")).toBeNull();
    expect(screen.getByText(/too old to show the season/)).toBeVisible();
  });
});
