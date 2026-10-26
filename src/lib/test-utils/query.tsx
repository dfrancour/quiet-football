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

/** The URL a fetch was asked for, however it was named. */
export function requestUrl(input: RequestInfo | URL | undefined): string {
  if (input === undefined) return "";
  return input instanceof Request ? input.url : input.toString();
}

/**
 * Answers every fetch with what `answer` gives for its URL: a Response as it
 * is, anything else as its JSON body.
 */
export function stubFetch(
  answer: (url: string) => unknown,
): ReturnType<typeof vi.fn<typeof fetch>> {
  const mock = vi.fn<typeof fetch>(async (input) => {
    const result = answer(requestUrl(input));
    return result instanceof Response ? result : Response.json(result);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}
