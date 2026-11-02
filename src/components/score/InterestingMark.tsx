"use client";

import { Sparkle } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";

/** The card's width, and how far it keeps from the mark and the window's edge. */
const CARD_WIDTH = 200;
const GAP = 6;
const MARGIN = 8;

/**
 * Where the card goes: centred over the mark, kept inside the window, and
 * below it where there is no room above.
 */
function cardStyle(mark: DOMRect): CSSProperties {
  const left = Math.max(
    MARGIN,
    Math.min(
      mark.left + mark.width / 2 - CARD_WIDTH / 2,
      window.innerWidth - CARD_WIDTH - MARGIN,
    ),
  );
  return mark.top > 96
    ? {
        left,
        width: CARD_WIDTH,
        bottom: window.innerHeight - mark.top + GAP,
      }
    : { left, width: CARD_WIDTH, top: mark.bottom + GAP };
}

/**
 * Beside a finished game worth watching (`interesting.ts`): a small
 * sparkle, the same glyph as the switch in the spoilers control that turns
 * it on, which names it. A pointer resting on it gets a card naming it,
 * saying no more of how the game went than the mark does;
 * it is drawn over the page, since the schedules scroll within themselves
 * and would clip it, and leaves as soon as the page scrolls.
 */
export function InterestingMark({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mark, setMark] = useState<DOMRect | null>(null);

  const pointing = mark !== null;
  useEffect(() => {
    if (!pointing) return;
    const leave = () => setMark(null);
    window.addEventListener("scroll", leave, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", leave, { capture: true });
  }, [pointing]);

  return (
    <span
      ref={ref}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        setMark(ref.current?.getBoundingClientRect() ?? null);
      }}
      onPointerLeave={() => setMark(null)}
      className={cn("text-accent-strong inline-flex shrink-0", className)}
    >
      <Sparkle className="size-3" fill="currentColor" aria-hidden />
      <span className="sr-only">Interesting game</span>
      {mark &&
        createPortal(
          <span
            aria-hidden
            style={cardStyle(mark)}
            className="border-edge bg-surface-raised pointer-events-none fixed z-30 flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left font-sans text-xs whitespace-normal shadow-lg"
          >
            <span className="text-ink flex items-center gap-1.5 font-semibold">
              <Sparkle
                className="text-accent-strong size-3 shrink-0"
                fill="currentColor"
                aria-hidden
              />
              Interesting game
            </span>
            <span className="text-ink-muted font-normal">
              Game metrics suggest it may be worth watching.
            </span>
          </span>,
          document.body,
        )}
    </span>
  );
}
