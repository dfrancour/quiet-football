import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { About } from "~/components/layout/About";
import { AUTHOR_URL, REPO_URL } from "~/lib/site";

describe("About", () => {
  it("leads home and links out to the author and the source", () => {
    render(<About />);
    expect(
      screen.getByRole("link", { name: "Quiet Football" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "dfrancour.dev" })).toHaveAttribute(
      "href",
      AUTHOR_URL,
    );
    expect(
      screen.getByRole("link", { name: "Source on GitHub" }),
    ).toHaveAttribute("href", REPO_URL);
    expect(
      screen.getByRole("link", { name: "contact@quiet-football.com" }),
    ).toHaveAttribute("href", "mailto:contact@quiet-football.com");
    expect(screen.getByText(/not affiliated with/)).toBeInTheDocument();
  });

  it("is named in the header after the site's mark, with nothing to close", () => {
    render(<About />);
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Quiet Football/About",
    );
    expect(screen.queryByRole("link", { name: "Close" })).toBeNull();
  });
});
