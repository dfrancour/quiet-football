import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayFeed } from "~/components/game/PlayFeed";
import { extractPlayByPlay, playsInOrder } from "~/lib/plays";
import { SHORT_GAME } from "~/lib/test-utils/espn-summaries";
import { TEAMS } from "~/lib/test-utils/fixtures";

const drives = extractPlayByPlay(SHORT_GAME);
const last = playsInOrder(drives).at(-1);

/** A 100px list with every row drawn below it, so any kept row scrolls. */
function scrollable() {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.tagName === "OL" ? 0 : 500;
      return DOMRect.fromRect({
        y: top,
        height: this.tagName === "OL" ? 100 : 20,
      });
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PlayFeed", () => {
  it("scrolls to a new selection and leaves the list alone after", () => {
    if (!last) throw new Error("The fixture has plays");
    scrollable();
    const props = {
      home: TEAMS.NO,
      away: TEAMS.MIN,
      selectedId: last.id,
    };
    const { rerender } = render(<PlayFeed {...props} drives={drives} />);
    const list = screen.getAllByRole("list")[0]!;
    expect(list.scrollTop).toBeGreaterThan(0);

    // The viewer scrolls away; the same drives arrive rebuilt.
    list.scrollTop = 0;
    rerender(<PlayFeed {...props} drives={[...drives]} />);
    expect(list.scrollTop).toBe(0);
  });
});
