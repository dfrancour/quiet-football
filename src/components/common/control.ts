import { cn } from "~/lib/utils";

/** A control's ink at rest; hovered, it is a step brighter. */
export type ControlTone = "faint" | "muted" | "accent";

/**
 * How a control takes its room:
 *
 * - `glyph`: an icon or a label whose hit area reaches 8px past it on every
 *   side without taking the room, so it sits in a line of text
 * - `text`: a line of words whose hit area reaches 8px above and below
 * - `box`: a box of its own, filled when hovered: `size` square, or as wide
 *   as its words when `fit`
 */
export type ControlShape = "glyph" | "text" | "box";

const TONE: Record<ControlTone, string> = {
  faint: "text-ink-faint hover:text-ink-muted",
  muted: "text-ink-muted hover:text-ink",
  accent: "text-accent-strong hover:text-ink",
};

const SHAPE: Record<ControlShape, string> = {
  glyph: "-m-2 shrink-0 rounded-md p-2",
  text: "-my-2 inline-flex items-center gap-1.5 py-2 whitespace-nowrap",
  box: "hover:bg-surface-raised inline-flex shrink-0 items-center justify-center rounded-md select-none",
};

/** A box's side: 32px in a header, 36 in a row of controls, 44 on a bar. */
export type ControlSize = 8 | 9 | 11;

const SQUARE: Record<ControlSize, string> = {
  8: "size-8",
  9: "size-9",
  11: "size-11",
};

const FIT: Record<ControlSize, string> = {
  8: "h-8 gap-1.5 px-2",
  9: "h-9 gap-1.5 px-1.5",
  11: "h-11 gap-1.5 px-2",
};

/**
 * The classes for a control, so every one reads the same at rest, hovered
 * and disabled: a step brighter hovered, faded and unfilled disabled. The
 * pointer is the base layer's. Add only what the recipe leaves open (text
 * size, weight, layout within a parent), never a colour, padding or size:
 * `cn` does not merge, so a clash is settled by the stylesheet's order.
 */
export function control({
  tone = "faint",
  shape,
  size = 9,
  fit = false,
}: {
  tone?: ControlTone;
  shape: ControlShape;
  /** A box's side. */
  size?: ControlSize;
  /** A box as wide as its words. */
  fit?: boolean;
}): string {
  return cn(
    TONE[tone],
    SHAPE[shape],
    shape === "box" && (fit ? FIT[size] : SQUARE[size]),
    "transition-colors disabled:bg-transparent disabled:text-ink-faint/40",
  );
}
