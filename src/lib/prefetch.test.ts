import { afterEach, describe, expect, it, vi } from "vitest";
import { PREFETCH_SCRIPT, takePrefetched } from "~/lib/prefetch";
import { currentSeason } from "~/lib/season-calendar";
import { weekScoreboardUrl } from "~/lib/season-sync";
import { STANDINGS_URL } from "~/lib/team-fetch";
import { requestUrl, stubFetch } from "~/lib/test-utils/query";
import { saveTeams, saveWeek } from "~/lib/week-store";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
  delete window.__prefetched;
});

/** Runs the script as the page's head would. */
function run() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script is a string the page inlines; running it is the test
  const script = new Function(PREFETCH_SCRIPT) as () => void;
  script();
}

describe("PREFETCH_SCRIPT", () => {
  it("starts every regular-season week and the standings, as the queries name them", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2027-01-20T12:00:00Z"));
    const season = currentSeason(Date.now());
    expect(season).toBe(2026);
    const fetchMock = stubFetch(() => ({}));
    run();
    const urls = fetchMock.mock.calls.map(([url]) => requestUrl(url));
    expect(urls).toEqual([
      ...Array.from({ length: 18 }, (_, i) => weekScoreboardUrl(season, i + 1)),
      `${STANDINGS_URL}?level=3&season=${season}`,
    ]);
    expect([...window.__prefetched!.keys()]).toEqual(urls);
  });

  it("leaves what an earlier visit saved to the query layer", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-16T12:00:00Z"));
    saveWeek(2026, 3, { events: [] }, 0);
    saveTeams(2026, { teams: [] }, 0);
    const fetchMock = stubFetch(() => ({}));
    run();
    const urls = fetchMock.mock.calls.map(([url]) => requestUrl(url));
    expect(urls).toHaveLength(17);
    expect(urls).not.toContain(weekScoreboardUrl(2026, 3));
    expect(urls.some((url) => url.startsWith(STANDINGS_URL))).toBe(false);
  });

  it("leaves a failed read to the query layer without reporting it", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    // Not a mock: one would handle the rejection itself, to note how it settled.
    vi.stubGlobal("fetch", () =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    run();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("asks for nothing when storage cannot be read", () => {
    const fetchMock = stubFetch(() => ({}));
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    run();
    getItem.mockRestore();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.__prefetched).toBeUndefined();
  });
});

describe("takePrefetched", () => {
  it("hands a started response over once", () => {
    const pending = Promise.resolve(Response.json({}));
    window.__prefetched = new Map([["https://example.test/x", pending]]);
    expect(takePrefetched("https://example.test/x")).toBe(pending);
    expect(takePrefetched("https://example.test/x")).toBeNull();
    expect(takePrefetched("https://example.test/y")).toBeNull();
  });
});
