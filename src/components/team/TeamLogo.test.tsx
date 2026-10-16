import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamLogo } from "~/components/team/TeamLogo";
import { TEAMS } from "~/lib/test-utils/fixtures";

/** next/image rewrites the path through its optimizer, so match on the file. */
function renderedLogoPath(container: HTMLElement): string | null {
  const img = container.querySelector("img");
  return img ? decodeURIComponent(img.getAttribute("src") ?? "") : null;
}

describe("TeamLogo", () => {
  it("renders the team's mark from ESPN's CDN", () => {
    const { container } = render(<TeamLogo team={TEAMS.MIN} />);
    expect(renderedLogoPath(container)).toContain("/min.png");
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
