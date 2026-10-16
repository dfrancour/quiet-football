import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

export interface LinescoreRow {
  team: Team;
  /** Points per period so far, overtime included. */
  periods: number[];
  emphasis?: boolean;
}

interface LinescoreProps {
  /** Away first. */
  rows: [LinescoreRow, LinescoreRow];
}

const REGULATION_PERIODS = 4;

/** 1–4, then OT, 2OT for each extra period. */
function periodHeading(index: number): string {
  if (index < REGULATION_PERIODS) return String(index + 1);
  const overtime = index - REGULATION_PERIODS + 1;
  return overtime === 1 ? "OT" : `${overtime}OT`;
}

/**
 * Points by quarter. Regulation columns are always drawn; overtime columns
 * only once played. No totals: the score row gives them. Render only when
 * spoilers are shown.
 */
export function Linescore({ rows }: LinescoreProps) {
  const columns = Math.max(
    REGULATION_PERIODS,
    ...rows.map((row) => row.periods.length),
  );
  const indexes = Array.from({ length: columns }, (_, index) => index);

  return (
    // Sized to its figures, not the panel, so the columns stay together.
    <table className="w-auto font-mono text-sm tabular-nums">
      <caption className="sr-only">Scoring by quarter</caption>
      <thead>
        <tr className="text-ink-faint text-xs">
          <th scope="col" className="pr-2 pb-1 text-left font-normal">
            <span className="sr-only">Team</span>
          </th>
          {indexes.map((index) => (
            <th
              key={index}
              scope="col"
              className="w-8 pb-1 text-right font-normal"
            >
              {periodHeading(index)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.team.teamId} className="border-edge first:border-t">
            <th
              scope="row"
              className={cn(
                "py-1 pr-2 text-left text-xs font-normal tracking-wide",
                row.emphasis ? "text-ink font-semibold" : "text-ink-muted",
              )}
            >
              {row.team.abbreviation}
            </th>
            {indexes.map((index) => (
              <td key={index} className="text-ink-muted py-1 text-right">
                {row.periods[index] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
