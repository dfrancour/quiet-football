import { type z } from "zod";

/**
 * A localStorage value for `useSyncExternalStore`, picking up other tabs'
 * writes. Blocked or corrupt storage reads as `empty`; a failed write still
 * holds in memory.
 */
export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  get: () => T;
  getServer: () => T;
  set: (next: T) => void;
  /** For tests: the next read hits storage again. */
  resetCache: () => void;
}

export function createLocalStore<T>(
  key: string,
  schema: z.ZodType<T>,
  empty: T,
): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cache: T | null = null;

  function read(): T {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return empty;
      const parsed = schema.safeParse(JSON.parse(raw) as unknown);
      return parsed.success ? parsed.data : empty;
    } catch {
      return empty;
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== null && event.key !== key) return;
        cache = null;
        listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    get() {
      cache ??= read();
      return cache;
    },
    getServer: () => empty,
    set(next) {
      cache = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      for (const listener of listeners) listener();
    },
    resetCache() {
      cache = null;
    },
  };
}
