"use client";

import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { control } from "~/components/common/control";
import { Sheet } from "~/components/common/Sheet";

/**
 * A phone's way through a season, along the bottom within reach of a thumb:
 * the week before and after either side of what is chosen, which opens
 * every week as a sheet. The caller places the bar; closed, the sheet hands
 * focus back to it.
 */
export function StepperBar({
  onBack,
  onNext,
  sheetLabel,
  children,
  sheet,
}: {
  /** To the week before; null when there is none. */
  onBack: (() => void) | null;
  /** To the week after; null when there is none. */
  onNext: (() => void) | null;
  /** Names the sheet. */
  sheetLabel: string;
  /** What is chosen, on the bar between the steps. */
  children: ReactNode;
  /** The sheet's contents, given its close for a pick to call. */
  sheet: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Held as state, not a ref, since the sheet's contents are drawn with the
  // close that reads it.
  const [bar, setBar] = useState<HTMLButtonElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    bar?.focus();
  }, [bar]);

  const step = (to: (() => void) | null, label: string, next: boolean) => {
    const Icon = next ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        aria-label={label}
        disabled={to === null}
        onClick={() => to?.()}
        className={control({ tone: "muted", shape: "box", size: 11 })}
      >
        <Icon className="size-5" aria-hidden />
      </button>
    );
  };

  return (
    <div className="border-edge flex items-center border-t py-1">
      {step(onBack, "Previous week", false)}
      <button
        ref={setBar}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="hover:bg-surface-raised/60 flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm transition-colors"
      >
        {children}
        <ChevronUp className="text-ink-faint size-4 shrink-0" aria-hidden />
      </button>
      {step(onNext, "Next week", true)}

      {open && (
        <Sheet label={sheetLabel} onClose={close}>
          {sheet(close)}
        </Sheet>
      )}
    </div>
  );
}
