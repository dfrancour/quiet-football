/**
 * Field positions use ESPN's frame: yards from the **home** goal line. 0 is
 * the home goal, 100 the away goal; the home offense drives toward 100. Every
 * spot ESPN reports is in this frame; convert only when drawing.
 */
export type HomeYardLine = number;

export type FieldSide = "home" | "away";

export const FIELD_YARDS = 100;

/** +1 when the offense gains yards by counting up, -1 when counting down. */
export function forward(offense: FieldSide): 1 | -1 {
  return offense === "home" ? 1 : -1;
}

/** The line to gain, or null when it would sit in the end zone (goal to go). */
export function lineToGain(
  ballOn: HomeYardLine,
  distance: number,
  offense: FieldSide,
): HomeYardLine | null {
  const target = ballOn + forward(offense) * distance;
  return target <= 0 || target >= FIELD_YARDS ? null : target;
}

/** "SEA 45", "SF 22", "50". */
export function spotLabel(
  spot: HomeYardLine,
  home: string,
  away: string,
): string {
  if (spot === FIELD_YARDS / 2) return "50";
  return spot < FIELD_YARDS / 2
    ? `${home} ${spot}`
    : `${away} ${FIELD_YARDS - spot}`;
}

export function isOnField(value: number | null | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= FIELD_YARDS
  );
}
