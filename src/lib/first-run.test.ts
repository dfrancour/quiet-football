import { afterEach, describe, expect, it } from "vitest";
import {
  getIntroduced,
  markIntroduced,
  resetIntroducedCache,
} from "~/lib/first-run";

afterEach(() => {
  window.localStorage.clear();
  resetIntroducedCache();
});

describe("first run", () => {
  it("starts unshown and stays shown once marked", () => {
    expect(getIntroduced()).toBe(false);
    markIntroduced();
    expect(getIntroduced()).toBe(true);
    expect(window.localStorage.getItem("spoilers-introduced")).toBe("true");
    markIntroduced();
    expect(getIntroduced()).toBe(true);
  });

  it("reads a malformed value as unshown", () => {
    window.localStorage.setItem("spoilers-introduced", '"yes"');
    expect(getIntroduced()).toBe(false);
  });
});
