import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeFailure,
  fetchUpstream,
  isPermanentFailure,
  UpstreamError,
} from "~/lib/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchUpstream", () => {
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
});

describe("isPermanentFailure", () => {
  it("is a 4xx from upstream, and nothing else", () => {
    expect(isPermanentFailure(new UpstreamError("x", 404))).toBe(true);
    expect(isPermanentFailure(new UpstreamError("x", 503))).toBe(false);
    expect(isPermanentFailure(new UpstreamError("x"))).toBe(false);
    expect(isPermanentFailure(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("describeFailure", () => {
  it("puts the browser's bare errors in the viewer's terms", () => {
    expect(describeFailure(new TypeError("Failed to fetch"))).toMatch(
      /could not be reached/,
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
