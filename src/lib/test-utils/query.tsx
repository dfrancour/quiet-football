import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { vi } from "vitest";

/** A fresh cache per test, failing fast instead of retrying. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

export function queryWrapper(client = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

/** Answers every fetch with one JSON body, or a status for a URL that matches. */
export function stubFetch(
  answer: (url: string) => unknown | Response,
): ReturnType<typeof vi.fn<typeof fetch>> {
  const mock = vi.fn<typeof fetch>(async (input) => {
    const result = answer(String(input));
    return result instanceof Response ? result : Response.json(result);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
