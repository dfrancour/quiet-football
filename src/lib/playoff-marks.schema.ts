/** ESPN's standing in the playoff race for one team. */
export interface PlayoffMark {
  /** The conference seed as things stand; ESPN ranks all sixteen teams. */
  seed: number | null;
  /** ESPN's code: `x`, `y`, `z`, `*`, `**` or `e`. */
  clincher: string | null;
}

/** A season's marks, by team id, as ESPN last reported them. */
export interface PlayoffMarks {
  teams: Record<string, PlayoffMark>;
}
