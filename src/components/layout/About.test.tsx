import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { About } from "~/components/layout/About";
import { REPO_URL } from "~/lib/site";
import { router } from "~/lib/test-utils/setup";

describe("About", () => {
  it("leads home and links out to the source", () => {
    render(<About />);
    expect(
      screen.getByRole("link", { name: "Quiet Football" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Source on GitHub" }),
    ).toHaveAttribute("href", REPO_URL);
    expect(
      screen.getByRole("link", { name: "contact@quiet-football.com" }),
    ).toHaveAttribute("href", "mailto:contact@quiet-football.com");
    expect(screen.getByText(/not affiliated with/)).toBeInTheDocument();
  });

  it("closes back to the league, in place of itself, by its control or Escape", () => {
    render(<About />);
    // A link, so it closes without a script too.
    expect(screen.getByRole("link", { name: "Close" })).toHaveAttribute(
      "href",
      "/",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
