import { act, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revealClass, useRevealed } from "~/hooks/useRevealed";

function Page({ marks }: { marks: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(ref);
  return (
    <div ref={ref} data-testid="body" className={revealClass(revealed)}>
      {Array.from({ length: marks }, (_, i) => (
        <img key={i} alt="" src={`https://a.espncdn.com/${i}.png`} />
      ))}
    </div>
  );
}

afterEach(() => vi.useRealTimers());

describe("useRevealed", () => {
  it("shows a page with no marks at once", async () => {
    render(<Page marks={0} />);
    await waitFor(() =>
      expect(screen.getByTestId("body")).toHaveClass("opacity-100"),
    );
  });

  it("holds the page until its marks have arrived", async () => {
    render(<Page marks={2} />);
    const body = screen.getByTestId("body");
    expect(body).toHaveClass("opacity-0");
    for (const img of body.querySelectorAll("img")) {
      act(() => img.dispatchEvent(new Event("load")));
    }
    await waitFor(() => expect(body).toHaveClass("opacity-100"));
  });

  it("gives up waiting after a moment, so a slow mark never holds the season", () => {
    vi.useFakeTimers();
    render(<Page marks={2} />);
    expect(screen.getByTestId("body")).toHaveClass("opacity-0");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("body")).toHaveClass("opacity-100");
  });
});
