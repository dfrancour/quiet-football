"use client";

/** Shown when a page throws while drawing. */
export default function PageError({ reset }: { reset: () => void }) {
  return (
    <div className="text-ink-muted flex min-h-screen items-center justify-center px-4 text-sm">
      <p>
        This page could not be drawn.{" "}
        <button
          type="button"
          onClick={reset}
          className="text-ink hover:text-accent-strong underline underline-offset-4 transition-colors"
        >
          Try again
        </button>
      </p>
    </div>
  );
}
