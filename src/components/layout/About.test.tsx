import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { About } from "~/components/layout/About";
import { REPO_URL } from "~/lib/site";

describe("About", () => {
  it("leads home and links out to the source", () => {
    render(<About />);
    expect(
      screen.getByRole("link", { name: "Quiet Football" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Source on GitHub" }),
    ).toHaveAttribute("href", REPO_URL);
    expect(screen.getByRole("link", { name: "open dataset" })).toHaveAttribute(
      "href",
      RECAP_DATASET_URL,
    );
    expect(screen.getByText(/not affiliated with/)).toBeInTheDocument();
  });
});
