"use client";

import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isPermanentFailure, retryAfterOf } from "~/lib/upstream";

/**
 * One query cache for the session; it is the app's only store. A failed read
 * is tried once more, so an outage shows within seconds rather than a minute,
 * and no sooner than the source asked. Nothing is fetched again just because
 * the tab was looked at: each query's own policy says when.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    // Query assumes a connection until told otherwise; a page opened offline
    // should wait for one (and load on its own when it comes) rather than fail.
    if (typeof navigator !== "undefined") {
      onlineManager.setOnline(navigator.onLine);
    }
    return new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failures, error) =>
            !isPermanentFailure(error) && failures < 1,
          retryDelay: (attempt, error) =>
            retryAfterOf(error) ?? Math.min(1000 * 2 ** attempt, 30_000),
          refetchOnWindowFocus: false,
        },
      },
    });
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
