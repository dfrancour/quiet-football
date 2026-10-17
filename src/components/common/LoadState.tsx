"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AboutLink } from "~/components/layout/SiteHeader";
import { SiteMark } from "~/components/layout/SiteMark";
import { FootballMark } from "~/components/score/Football";
import { WeekLoadError } from "~/hooks/useLeague";
import { useNow } from "~/hooks/useNow";
import { useOnline } from "~/hooks/useOnline";
import { standingsPath } from "~/lib/routes";
import { describeFailure } from "~/lib/upstream";
import { cn } from "~/lib/utils";

/** How long the mark breathes before it says what it is waiting on. */
const SLOW_MS = 3_000;

const OFFLINE_NOTE = "You're offline. The season will load when you're back.";

interface FrameProps {
  busy?: boolean;
  /** Whether the page the frame stands in for offers About (the league does). */
  about?: boolean;
  children: ReactNode;
}

/**
 * The page before its season is there: the header every page shares, with
 * the matter centred beneath, so the frame holds still when the season
 * fades in.
 */
function Frame({ busy = false, about = true, children }: FrameProps) {
  return (
    <div
      aria-busy={busy || undefined}
      className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6"
    >
      <header className="flex min-h-8 items-center justify-between gap-3">
        <SiteMark href={standingsPath()} />
        {about && <AboutLink />}
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
        {children}
      </div>
    </div>
  );
}

/** The site's mark, breathing while the season is on the way. */
function Mark({ breathing }: { breathing: boolean }) {
  return (
    <svg
      viewBox="0 0 52 32"
      className={cn(
        "text-ink-faint mb-1 h-6 w-10 fill-current",
        breathing && "animate-breathe",
      )}
      aria-hidden
    >
      <FootballMark cx={26} cy={16} radius={24} className="fill-current" />
    </svg>
  );
}

/** The page's frame while its season is on the way. */
export function Loading({ about }: { about?: boolean } = {}) {
  const online = useOnline();
  const now = useNow();
  const [started] = useState(() => Date.now());
  const note = !online
    ? OFFLINE_NOTE
    : now !== null && now - started >= SLOW_MS
      ? "Still waiting on ESPN…"
      : null;
  return (
    <Frame busy about={about}>
      <Mark breathing />
      <p aria-live="polite" className="text-ink-faint min-h-4 text-xs">
        {note}
      </p>
    </Frame>
  );
}

/** Shown when the season could not be fetched, e.g. ESPN unreachable. */
export function LoadFailed({
  error,
  about,
}: {
  error: Error;
  about?: boolean;
}) {
  const client = useQueryClient();
  const online = useOnline();
  const named = error instanceof WeekLoadError ? error : null;
  return (
    <Frame about={about}>
      <Mark breathing={false} />
      <p className="text-ink-muted text-sm">
        {named
          ? `${named.weekName} could not be loaded.`
          : "The season could not be loaded."}{" "}
        <button
          type="button"
          // Only what failed is asked for again; what arrived is kept.
          onClick={() =>
            void client.resetQueries({
              predicate: (query) => query.state.status === "error",
            })
          }
          className="text-ink hover:text-accent-strong underline underline-offset-4 transition-colors"
        >
          Try again
        </button>
      </p>
      <p className="text-ink-faint text-xs">
        {online ? describeFailure(named?.cause ?? error) : OFFLINE_NOTE}
      </p>
    </Frame>
  );
}
