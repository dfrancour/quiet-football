"use client";

import { Redacted } from "~/components/common/Redacted";
import { SiteHeader } from "~/components/layout/SiteHeader";
import { FavoriteStar } from "~/components/team/FavoriteStar";
import { TeamLogo } from "~/components/team/TeamLogo";
import { formatRecord, type TeamRecord } from "~/lib/schedule";
import { type Team } from "~/lib/teams.schema";

interface AppHeaderProps {
  team: Team;
  /** Through the viewer's week; null while nothing is. */
  record: TeamRecord | null;
  through: number;
  settledThrough: number;
  currentWeek: number;
  totalWeeks: number;
  onCatchUp: (week: number) => void;
}

/** The site bar with the team's mark, name, record and favorite star. */
export function AppHeader({
  team,
  record,
  through,
  settledThrough,
  currentWeek,
  totalWeeks,
  onCatchUp,
}: AppHeaderProps) {
  return (
    <SiteHeader
      through={through}
      settledThrough={settledThrough}
      currentWeek={currentWeek}
      totalWeeks={totalWeeks}
      onCatchUp={onCatchUp}
    >
      <span className="flex min-w-0 items-center gap-3">
        <TeamLogo team={team} size="md" />
        <h1 className="text-ink truncate text-lg font-semibold tracking-tight">
          {team.displayName}
        </h1>
        <span className="text-ink-muted shrink-0 font-mono text-sm tabular-nums">
          <span className="sr-only">Record </span>
          {record ? formatRecord(record) : <Redacted chars={3} />}
        </span>
        <FavoriteStar abbreviation={team.abbreviation} />
      </span>
    </SiteHeader>
  );
}
