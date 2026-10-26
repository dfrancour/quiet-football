import { cn } from "~/lib/utils";

interface FootballMarkProps {
  cx: number;
  cy: number;
  /** Half the ball's length in the parent's drawing units. */
  radius: number;
  className?: string;
}

/** The ball drawn inside another SVG, shared by the field and markers. */
export function FootballMark({
  cx,
  cy,
  radius,
  className = "fill-white",
}: FootballMarkProps) {
  // Each side is an arc through the points; its radius follows from the
  // ball's half-length and half-height.
  const height = radius * 0.56;
  const arc = (radius ** 2 + height ** 2) / (2 * height);
  // The caps round the seam's ends, so it reaches a little past its width.
  const seam = { width: radius * 0.66, height: radius * 0.14 };
  const d = [
    `M ${cx - radius} ${cy}`,
    `A ${arc} ${arc} 0 0 1 ${cx + radius} ${cy}`,
    `A ${arc} ${arc} 0 0 1 ${cx - radius} ${cy} Z`,
  ].join(" ");
  return (
    <g>
      <path d={d} className={className} />
      <line
        x1={cx - seam.width / 2}
        x2={cx + seam.width / 2}
        y1={cy}
        y2={cy}
        stroke="black"
        strokeWidth={seam.height}
        strokeLinecap="round"
        opacity={0.4}
      />
    </g>
  );
}

/** A standalone ball marking the side in possession, in the text colour. */
export function FootballIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 32"
      className={cn("fill-current", className)}
      role="img"
      aria-label="Has the ball"
    >
      <FootballMark cx={26} cy={16} radius={24} className="fill-current" />
    </svg>
  );
}
