import Link from "next/link";
import { Redacted } from "~/components/common/Redacted";
import { TeamLogo } from "~/components/team/TeamLogo";
import { clincherName, PLAYOFF_SEEDS } from "~/lib/playoff-marks";
import { type PlayoffMark } from "~/lib/playoff-marks.schema";
import { teamPath } from "~/lib/routes";
import { formatRecord } from "~/lib/schedule";
import { type StandingsRow } from "~/lib/standings";
import { tintStyle } from "~/lib/team-tint";
import { type Conference, type Division } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

/** What a table row shows: none of the tiebreak inputs behind its order. */
export type StandingsLine = Pick<StandingsRow, "team" | "record"> & {
  /** ESPN's seed and clinch code; null until fetched. */
  mark: PlayoffMark | null;
};

/**
 * The race for the playoffs: the clinch code after the name, the seed (as
 * things stand) before the record. Both give results away.
 */
function Clincher({ code }: { code: string }) {
  const name = clincherName(code);
  return (
    <span
      className="text-ink-faint shrink-0 font-mono text-xs"
      title={name ?? undefined}
    >
      {name ? <span className="sr-only">{name}</span> : null}
      <span aria-hidden={name !== null}>{code}</span>
    </span>
  );
}

function SeedFigure({ seed }: { seed: number }) {
  const label = `Seed ${seed}${seed > 4 ? ", wild card" : ""}`;
  return (
    <span className="text-ink-faint" title={label}>
      <span className="sr-only">{label}</span>
      <span aria-hidden>{seed}</span>
    </span>
  );
}

export interface StandingsView {
  conference: Conference;
  divisions: { division: Division; rows: StandingsLine[] }[];
}

interface StandingsTablesProps {
  standings: StandingsView[];
  showSpoilers: boolean;
  /** Teams pointed at elsewhere on the page; their rows light up. */
  highlighted?: ReadonlySet<string>;
  /** The viewer's teams, each row tinted in its team's color. */
  favorites?: ReadonlySet<string>;
  /** Points at a team, or at nothing. */
  onPoint?: (teamIds: readonly string[]) => void;
  /** The week a team's page opens on, as `weekParam()` names it; its default if absent. */
  week?: string;
}

const NOTHING: ReadonlySet<string> = new Set();

function DivisionTable({
  conference,
  division,
  rows,
  showSpoilers,
  highlighted,
  favorites,
  onPoint,
  week,
}: {
  conference: Conference;
  division: Division;
  rows: StandingsLine[];
} & Required<Omit<StandingsTablesProps, "standings" | "week">> &
  Pick<StandingsTablesProps, "week">) {
  // The order reveals results, so hidden divisions list alphabetically, by
  // the name each row shows.
  const ordered = showSpoilers
    ? rows
    : [...rows].sort((a, b) => a.team.nickname.localeCompare(b.team.nickname));

  return (
    <table className="w-full text-sm">
      <caption className="label-eyebrow pb-1 text-left">
        <span className="sr-only">{conference}</span> {division}
      </caption>
      <tbody>
        {ordered.map(({ team, record, mark }) => {
          const favorite = favorites.has(team.teamId);
          return (
            <tr
              key={team.teamId}
              onMouseEnter={() => onPoint([team.teamId])}
              onMouseLeave={() => onPoint([])}
              onFocus={() => onPoint([team.teamId])}
              onBlur={() => onPoint([])}
              className={cn(
                "border-edge relative border-t transition-colors",
                highlighted.has(team.teamId)
                  ? "bg-surface-raised"
                  : favorite && "team-tint",
              )}
              style={favorite ? tintStyle(team) : undefined}
            >
              <th scope="row" className="py-2 pr-2 pl-1 text-left font-normal">
                {/* The overlay makes the whole row one target and ring. */}
                <Link
                  href={teamPath(team.abbreviation, week)}
                  className="text-ink focus-visible:after:outline-accent-strong flex items-center gap-2 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2"
                >
                  <TeamLogo team={team} />
                  <span className="truncate">{team.nickname}</span>
                  {showSpoilers && mark?.clincher && (
                    <Clincher code={mark.clincher} />
                  )}
                </Link>
              </th>
              <td className="w-4 py-2 text-right font-mono text-xs tabular-nums">
                {showSpoilers &&
                  mark?.seed != null &&
                  mark.seed <= PLAYOFF_SEEDS && <SeedFigure seed={mark.seed} />}
              </td>
              <td className="text-ink-muted py-2 pr-1 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                <span className="sr-only">Record </span>
                {showSpoilers ? formatRecord(record) : <Redacted chars={3} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * NFC and AFC side by side, divisions North to West, with each team's record,
 * seed and clinch code masked by the spoiler switch. Each row links to the
 * team.
 */
export function StandingsTables({
  standings,
  showSpoilers,
  highlighted = NOTHING,
  favorites = NOTHING,
  onPoint = () => undefined,
  week,
}: StandingsTablesProps) {
  return (
    <div className="grid grid-cols-2 gap-x-6">
      {standings.map(({ conference, divisions }) => (
        <div key={conference} className="flex min-w-0 flex-col gap-4">
          <h3 className="text-ink-muted text-xs font-semibold tracking-[0.14em]">
            {conference}
          </h3>
          {divisions.map(({ division, rows }) => (
            <DivisionTable
              key={division}
              conference={conference}
              division={division}
              rows={rows}
              showSpoilers={showSpoilers}
              highlighted={highlighted}
              favorites={favorites}
              onPoint={onPoint}
              week={week}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
