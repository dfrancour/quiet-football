import { describe, expect, it } from "vitest";
import { asksNotToTrack } from "~/lib/tracking";

describe("asksNotToTrack", () => {
  it("is true for Global Privacy Control or Do Not Track", () => {
    expect(asksNotToTrack({ globalPrivacyControl: true })).toBe(true);
    expect(asksNotToTrack({ doNotTrack: "1" })).toBe(true);
  });

  it("is false for a browser that hasn't asked", () => {
    expect(asksNotToTrack({})).toBe(false);
    expect(
      asksNotToTrack({ globalPrivacyControl: false, doNotTrack: "0" }),
    ).toBe(false);
    expect(asksNotToTrack({ doNotTrack: null })).toBe(false);
  });
});
