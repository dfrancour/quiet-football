import { cn } from "~/lib/utils";

/**
 * A covered bar sized like the hidden figure (in `ch`), so nothing shifts
 * when it is uncovered. With `onReveal`, tapping it uncovers the figure.
 */
export function Redacted({
  chars = 2,
  onReveal,
  revealLabel = "Reveal score",
  className,
}: {
  /** About how many characters the hidden figure would take. */
  chars?: number;
  onReveal?: () => void;
  /** Names the control, so two covered scores read apart. */
  revealLabel?: string;
  className?: string;
}) {
  const style = { width: `${chars}ch` };
  if (onReveal) {
    return (
      <button
        type="button"
        onClick={onReveal}
        aria-label={revealLabel}
        // A fingertip is wider than the bar; the inset reaches past it.
        className={cn(
          "redacted redacted-reveal relative before:absolute before:-inset-3 before:content-['']",
          className,
        )}
        style={style}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="Hidden"
      className={cn("redacted", className)}
      style={style}
    />
  );
}
