"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useDismiss } from "~/hooks/useDismiss";

interface SheetProps {
  /** Names the dialog. */
  label: string;
  /** The eyebrow at the top; defaults to the label. */
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A phone's menu: a panel up from the bottom edge over a dimmed page, closed
 * by its control, Escape, or a tap outside. The page behind holds still and
 * the sheet takes focus, so Escape and a screen reader land in it. Render it
 * only while open; the caller puts focus back where it came from.
 */
export function Sheet({ label, title = label, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <div className="bg-surface-sunken/70 absolute inset-0" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="border-edge bg-surface-raised relative flex max-h-[85dvh] flex-col rounded-t-xl border-t px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg outline-none"
      >
        <div className="mb-1 flex items-center justify-between gap-3 px-3">
          <span className="label-eyebrow">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-faint hover:text-ink -m-2 cursor-pointer rounded-md p-2 transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
