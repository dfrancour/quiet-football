import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InterestingMark } from "~/components/score/InterestingMark";

const card = () => screen.queryByText(/may be worth watching/);

describe("InterestingMark", () => {
  it("names itself, and says why to a pointer resting on it", async () => {
    const user = userEvent.setup();
    render(<InterestingMark />);
    const mark = screen.getByText("Interesting game");
    expect(card()).toBeNull();
    await user.hover(mark);
    expect(card()).toBeInTheDocument();
    await user.unhover(mark);
    expect(card()).toBeNull();
  });

  it("leaves as the page scrolls", async () => {
    const user = userEvent.setup();
    render(<InterestingMark />);
    await user.hover(screen.getByText("Interesting game"));
    fireEvent.scroll(window);
    expect(card()).toBeNull();
  });

  it("is not opened by a touch, which would select the row instead", () => {
    render(<InterestingMark />);
    fireEvent.pointerEnter(screen.getByText("Interesting game"), {
      pointerType: "touch",
    });
    expect(card()).toBeNull();
  });
});
