import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayByPlay } from "~/hooks/usePlayByPlay";
import { GAME_ID } from "~/lib/test-utils/fixtures";
import { queryWrapper, requestUrl, stubFetch } from "~/lib/test-utils/query";

const OTHER_ID = "401872999";

/** ESPN's summary, bare: no drives, the game over or not. */
function summary(completed: boolean) {
  return {
    header: {
      competitions: [{ status: { type: { completed } }, competitors: [] }],
    },
    drives: { previous: [] },
  };
}

let fetchMock: ReturnType<typeof stubFetch>;
let completed = true;

beforeEach(() => {
  completed = true;
  fetchMock = stubFetch(() => summary(completed));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePlayByPlay", () => {
  it("fetches a game's summary by ESPN's id, once", async () => {
    const wrapper = queryWrapper();
    const { result, rerender } = renderHook(
      ({ gameId }) => usePlayByPlay(gameId, false),
      { wrapper, initialProps: { gameId: GAME_ID as string | null } },
    );
    await waitFor(() => expect(result.current?.gameId).toBe(GAME_ID));
    expect(requestUrl(fetchMock.mock.calls[0]?.[0])).toContain(
      `event=${GAME_ID}`,
    );

    rerender({ gameId: OTHER_ID });
    await waitFor(() => expect(result.current?.gameId).toBe(OTHER_ID));
    rerender({ gameId: GAME_ID });
    await waitFor(() => expect(result.current?.gameId).toBe(GAME_ID));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches nothing without a game", async () => {
    const { result } = renderHook(() => usePlayByPlay(null, false), {
      wrapper: queryWrapper(),
    });
    await new Promise((done) => setTimeout(done, 10));
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads a summary that did not yet call the game over once more when it ends", async () => {
    completed = false;
    const { result, rerender } = renderHook(
      ({ live }) => usePlayByPlay(GAME_ID, live),
      { wrapper: queryWrapper(), initialProps: { live: true } },
    );
    await waitFor(() => expect(result.current?.gameId).toBe(GAME_ID));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    completed = true;
    rerender({ live: false });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    rerender({ live: false });
    await new Promise((done) => setTimeout(done, 10));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads a live game again only as the scoreboard shows something new", async () => {
    completed = false;
    const { rerender } = renderHook(
      ({ mark }) => usePlayByPlay(GAME_ID, true, mark),
      { wrapper: queryWrapper(), initialProps: { mark: "Q1|0|0|Kickoff" } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender({ mark: "Q1|0|0|Kickoff" });
    await new Promise((done) => setTimeout(done, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ mark: "Q1|7|0|Touchdown" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
