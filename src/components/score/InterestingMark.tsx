import { Sparkle } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Beside a finished game worth watching (`interesting.ts`): a small
 * sparkle, the same glyph as the switch in the spoilers control that turns
 * it on, which names it.
 */
export function InterestingMark({ className }: { className?: string }) {
  return (
    <span className={cn("text-accent-strong inline-flex shrink-0", className)}>
      <Sparkle className="size-3" fill="currentColor" aria-hidden />
      <span className="sr-only">Interesting game</span>
    </span>
  );
}
