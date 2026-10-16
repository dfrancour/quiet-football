import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { logoAt, TeamLogo } from "~/components/team/TeamLogo";
import { TEAMS } from "~/lib/test-utils/fixtures";

function renderedLogoSrc(container: HTMLElement): string | null {
  const img = container.querySelector("img");
  return img ? decodeURIComponent(img.getAttribute("src") ?? "") : null;
}

describe("TeamLogo", () => {
  it("asks ESPN's CDN for the team's mark at the size it is drawn", () => {
    const { container } = render(<TeamLogo team={TEAMS.MIN} />);
    expect(renderedLogoSrc(container)).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500-dark/min.png&h=96&w=96",
    );
  });

  it("fades the mark in once it has arrived", async () => {
    const { container } = render(<TeamLogo team={TEAMS.MIN} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveClass("opacity-0");
    fireEvent.load(img);
    await waitFor(() => expect(img).toHaveClass("opacity-100"));
  });

  it("stays decorative where a team name sits beside it", () => {
    const { container } = render(<TeamLogo team={TEAMS.MIN} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByAltText(/Vikings/)).not.toBeInTheDocument();
  });

  it("names the team when asked to carry the label itself", () => {
    render(<TeamLogo team={TEAMS.MIN} labelled />);
    expect(screen.getByAltText("Minnesota Vikings")).toBeInTheDocument();
  });

  it("reserves the box for a team with no logo, rather than shifting the row", () => {
    const { container } = render(
      <TeamLogo team={{ ...TEAMS.MIN, logo: null }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("span")).toHaveClass("size-5");
  });
});

describe("logoAt", () => {
  it("leaves a mark on another host as it is", () => {
    expect(logoAt("https://example.com/mark.png", 96)).toBe(
      "https://example.com/mark.png",
    );
  });
});
