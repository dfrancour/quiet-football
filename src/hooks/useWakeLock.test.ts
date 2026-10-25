import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useWakeLock } from "~/hooks/useWakeLock";

/** A stand-in for the browser's wake lock, which drops locks on hide. */
class FakeWakeLock {
  held: FakeSentinel[] = [];
  requests = 0;
  refuse = false;

  request = (): Promise<FakeSentinel> => {
    this.requests += 1;
    if (this.refuse) return Promise.reject(new Error("NotAllowedError"));
    const sentinel = new FakeSentinel(this);
    this.held.push(sentinel);
    return Promise.resolve(sentinel);
  };

  dropAll() {
    for (const sentinel of [...this.held]) sentinel.drop();
  }
}

class FakeSentinel extends EventTarget {
  released = false;

  constructor(private readonly owner: FakeWakeLock) {
    super();
  }

  drop() {
    if (this.released) return;
    this.released = true;
    this.owner.held = this.owner.held.filter((s) => s !== this);
    this.dispatchEvent(new Event("release"));
  }

  release = (): Promise<void> => {
    this.drop();
    return Promise.resolve();
  };
}

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useWakeLock", () => {
  let wakeLock: FakeWakeLock;

  beforeEach(() => {
    wakeLock = new FakeWakeLock();
    visibility = "visible";
    Object.defineProperty(navigator, "wakeLock", {
      value: wakeLock,
      configurable: true,
    });
    Object.defineProperty(document, "visibilityState", {
      get: () => visibility,
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("holds the screen only while active", async () => {
    const { rerender, unmount } = renderHook(
      ({ active }) => useWakeLock(active),
      { initialProps: { active: false } },
    );
    await settle();
    expect(wakeLock.requests).toBe(0);

    rerender({ active: true });
    await settle();
    expect(wakeLock.held).toHaveLength(1);

    rerender({ active: false });
    await settle();
    expect(wakeLock.held).toHaveLength(0);

    rerender({ active: true });
    await settle();
    unmount();
    await settle();
    expect(wakeLock.held).toHaveLength(0);
  });

  it("asks again when the page comes back", async () => {
    renderHook(() => useWakeLock(true));
    await settle();
    expect(wakeLock.held).toHaveLength(1);

    act(() => {
      wakeLock.dropAll();
      setVisibility("hidden");
    });
    await settle();
    expect(wakeLock.held).toHaveLength(0);
    expect(wakeLock.requests).toBe(1);

    act(() => setVisibility("visible"));
    await settle();
    expect(wakeLock.held).toHaveLength(1);
    expect(wakeLock.requests).toBe(2);
  });

  it("does not stack locks while the page stays visible", async () => {
    renderHook(() => useWakeLock(true));
    await settle();
    act(() => setVisibility("visible"));
    await settle();
    expect(wakeLock.requests).toBe(1);
  });

  it("lets go of a lock granted after it stopped wanting one", async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    await settle();
    expect(wakeLock.requests).toBe(1);
    expect(wakeLock.held).toHaveLength(0);
  });

  it("does nothing when refused or unsupported", async () => {
    wakeLock.refuse = true;
    const { unmount } = renderHook(() => useWakeLock(true));
    await settle();
    expect(wakeLock.held).toHaveLength(0);
    unmount();

    Reflect.deleteProperty(navigator, "wakeLock");
    expect("wakeLock" in navigator).toBe(false);
    const unsupported = renderHook(() => useWakeLock(true));
    await settle();
    expect(() => unsupported.unmount()).not.toThrow();
  });
});
