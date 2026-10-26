import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeFailure,
  UnreachableError,
  fetchUpstream,
  isPermanentFailure,
  retryAfterOf,
  UpstreamError,
} from "~/lib/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.__prefetched;
});

describe("fetchUpstream", () => {
  it("takes a response the head started instead of asking again", async () => {
    const fetchMock = vi.fn(async () => Response.json({ fresh: true }));
    vi.stubGlobal("fetch", fetchMock);
    window.__prefetched = new Map([
      [
        "https://example.test/x",
        Promise.resolve(Response.json({ early: true })),
      ],
    ]);
    await expect(fetchUpstream("https://example.test/x")).resolves.toEqual({
      early: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    // Taken once: the next read is a request of its own.
    await expect(fetchUpstream("https://example.test/x")).resolves.toEqual({
      fresh: true,
    });
  });

  it("asks again the ordinary way when the head's request failed", async () => {
    const fetchMock = vi.fn(async () => Response.json({ fresh: true }));
    vi.stubGlobal("fetch", fetchMock);
    window.__prefetched = new Map([
      ["https://example.test/x", Promise.reject(new TypeError("Failed"))],
    ]);
    await expect(fetchUpstream("https://example.test/x")).resolves.toEqual({
      fresh: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the body, and names the host and status of a bad answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    await expect(fetchUpstream("https://example.test/x")).resolves.toEqual({
      ok: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    const failure = await fetchUpstream("https://example.test/x").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(UpstreamError);
    expect((failure as UpstreamError).message).toBe(
      "example.test responded 404",
    );
    expect((failure as UpstreamError).status).toBe(404);
  });

  it("keeps how long the source asked to be left alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, { status: 429, headers: { "Retry-After": "90" } }),
      ),
    );
    const failure = await fetchUpstream("https://example.test/x").catch(
      (error: unknown) => error,
    );
    expect(retryAfterOf(failure)).toBe(90_000);
    expect(isPermanentFailure(failure)).toBe(false);
    expect(retryAfterOf(new UpstreamError("x", 503))).toBeNull();
    expect(retryAfterOf(new TypeError("x"))).toBeNull();
  });
});

describe("isPermanentFailure", () => {
  it("is a 4xx from upstream, and nothing else", () => {
    expect(isPermanentFailure(new UpstreamError("x", 404))).toBe(true);
    expect(isPermanentFailure(new UpstreamError("x", 503))).toBe(false);
    expect(isPermanentFailure(new UpstreamError("x"))).toBe(false);
    expect(isPermanentFailure(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("fetchUpstream unreachable", () => {
  it("names a request the browser could not make at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const failure = await fetchUpstream("https://example.test/x").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(UnreachableError);
    expect(describeFailure(failure)).toMatch(/could not be reached/);
  });
});

describe("describeFailure", () => {
  it("puts the browser's bare errors in the viewer's terms", () => {
    expect(
      describeFailure(new UnreachableError("https://example.test/x")),
    ).toMatch(/could not be reached/);
    // A TypeError from anything but fetch is a bug, not the network.
    expect(describeFailure(new TypeError("x is undefined"))).toBe(
      "x is undefined",
    );
    expect(
      describeFailure(new DOMException("signal timed out", "TimeoutError")),
    ).toMatch(/did not answer in time/);
    expect(
      describeFailure(new UpstreamError("example.test responded 503", 503)),
    ).toBe("example.test responded 503");
    expect(describeFailure(new Error("ESPN has no schedule"))).toBe(
      "ESPN has no schedule",
    );
  });
});
