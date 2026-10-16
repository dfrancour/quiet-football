"use client";

import { useQueryClient } from "@tanstack/react-query";
import { SiteMark } from "~/components/layout/SiteMark";
import { standingsPath } from "~/lib/routes";

/** The page's frame while its season is on the way. */
export function Loading() {
  return (
    <div
      aria-busy
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6"
    >
      <header className="flex min-h-8 items-center">
        <SiteMark href={standingsPath()} />
      </header>
      <div className="bg-surface-sunken h-3 w-28 animate-pulse rounded" />
      <div className="bg-surface-sunken h-40 w-full animate-pulse rounded" />
    </div>
  );
}

/** Shown when the season could not be fetched, e.g. ESPN unreachable. */
export function LoadFailed({ error }: { error: Error }) {
  const client = useQueryClient();
  return (
    <div className="text-ink-muted flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-sm">
      <p>
        The season could not be loaded.{" "}
        <button
          type="button"
          onClick={() => void client.resetQueries()}
          className="text-ink hover:text-accent-strong underline underline-offset-4 transition-colors"
        >
          Try again
        </button>
      </p>
      <p className="text-ink-faint text-xs">{error.message}</p>
    </div>
  );
}
