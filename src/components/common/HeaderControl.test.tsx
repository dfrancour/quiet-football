import { fireEvent, render, screen } from "@testing-library/react";
import { Info, Rss, Star } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { HeaderControl } from "~/components/common/HeaderControl";

describe("HeaderControl", () => {
  it("is a box named to a reader and a pointer alike", () => {
    render(<HeaderControl label="About" icon={Info} href="/about" />);
    const link = screen.getByRole("link", { name: "About" });
    expect(link).toHaveAttribute("href", "/about");
    expect(link).toHaveAttribute("title", "About");
    expect(link).toHaveClass("size-8", "hover:bg-surface-raised");
    expect(link).not.toHaveAttribute("target");
  });

  it("opens a feed in a tab of its own, saying what it is", () => {
    render(
      <HeaderControl
        label="Recaps feed"
        icon={Rss}
        href="https://feeds.quiet-football.com/nfl/min.atom"
        type="application/atom+xml"
        newTab
      />,
    );
    const link = screen.getByRole("link", { name: "Recaps feed" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(link).toHaveAttribute("type", "application/atom+xml");
  });

  it("is a toggle given a press, its icon filled when on", () => {
    const onClick = vi.fn();
    render(
      <HeaderControl
        label="Favorite team"
        icon={Star}
        onClick={onClick}
        pressed
        filled
      />,
    );
    const button = screen.getByRole("button", { name: "Favorite team" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("size-8");
    expect(button.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
