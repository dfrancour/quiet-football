import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useFullScreen } from "~/hooks/useFullScreen";

/** A stand-in for the browser's Fullscreen API on the document. */
class FakeFullScreen {
  element: Element | null = null;
  enabled = true;
  refuse = false;
  requests = 0;

  enter = (): Promise<void> => {
    this.requests += 1;
    if (this.refuse)
      return Promise.reject(new TypeError("Permissions check failed"));
    this.element = document.documentElement;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };

  /** The browser leaving on its own, as on Escape or a back gesture. */
  exit = (): Promise<void> => {
    this.element = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFullScreen", () => {
  let screen: FakeFullScreen;

  beforeEach(() => {
    screen = new FakeFullScreen();
    Object.defineProperty(document, "fullscreenElement", {
      get: () => screen.element,
      configurable: true,
    });
    Object.defineProperty(document, "fullscreenEnabled", {
      get: () => screen.enabled,
      configurable: true,
    });
    Object.defineProperty(document, "exitFullscreen", {
      value: screen.exit,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      value: screen.enter,
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(document, "fullscreenEnabled");
    Reflect.deleteProperty(document, "exitFullscreen");
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  });

  it("puts the page full screen and takes it out again", async () => {
    const { result } = renderHook(() => useFullScreen());
    expect(result.current[0]).toBe(false);

    act(() => result.current[1]());
    await settle();
    expect(screen.element).toBe(document.documentElement);
    expect(result.current[0]).toBe(true);

    act(() => result.current[1]());
    await settle();
    expect(screen.element).toBeNull();
    expect(result.current[0]).toBe(false);
  });

  it("follows the browser leaving full screen on its own", async () => {
    const { result } = renderHook(() => useFullScreen());
    act(() => result.current[1]());
    await settle();

    await act(() => screen.exit());
    expect(result.current[0]).toBe(false);
  });

  it("leaves full screen when the page goes", async () => {
    const { result, unmount } = renderHook(() => useFullScreen());
    act(() => result.current[1]());
    await settle();

    unmount();
    expect(screen.element).toBeNull();
  });

  it("hides only the page's own chrome where the browser cannot", async () => {
    screen.enabled = false;
    const { result } = renderHook(() => useFullScreen());

    act(() => result.current[1]());
    expect(screen.requests).toBe(0);
    expect(result.current[0]).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current[0]).toBe(false);
  });

  it("hides only the page's own chrome where the browser refuses", async () => {
    screen.refuse = true;
    const { result } = renderHook(() => useFullScreen());

    act(() => result.current[1]());
    await settle();
    expect(screen.requests).toBe(1);
    expect(result.current[0]).toBe(true);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });
});
