import { type ReactNode } from "react";
import { playTime } from "~/components/game/PlayFeed";
import { Linescore } from "~/components/score/Linescore";
import { ScoreLine } from "~/components/score/ScoreLine";
import { pointsByPeriod, scoreAfter, timeoutsLeft } from "~/lib/plays";
import { type Drive, type Play } from "~/lib/plays.schema";
import { weekLabel } from "~/lib/schedule";
import { type TeamGame } from "~/lib/team-view";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

export function sides(game: TeamGame, team: Team): { away: Team; home: Team } {
  return game.homeAway === "home"
    ? { away: game.opponent, home: team }
    : { away: team, home: game.opponent };
}

export interface SideFigures {
  /** Null while hidden. */
  display: string | null;
  /** Must stay false while spoilers are hidden. */
  leading: boolean;
  hasBall?: boolean;
  timeouts?: number | null;
  record?: string | null;
  /** Unset while spoilers are hidden or the game is not decided. */
  won?: boolean | null;
}

export interface SidePeriods {
  followed: number[];
  opposing: number[];
}

/**
 * Away left and home right, matching the field's end zones. Teams stay
 * visible while figures are masked.
 *
 * Status and quarter grid sit between the scores, dropping below them when
 * the panel is too narrow.
 */
export function ScoreRow({
  game,
  team,
  followed,
  opposing,
  status,
  periods = null,
  onReveal,
}: {
  game: TeamGame;
  team: Team;
  followed: SideFigures;
  opposing: SideFigures;
  status: ReactNode;
  /** Makes a covered score the control that uncovers the game. */
  onReveal?: () => void;
  /** Spoilers only. */
  periods?: SidePeriods | null;
}) {
  const { away, home } = sides(game, team);
  const [awayFigures, homeFigures] =
    game.homeAway === "home" ? [opposing, followed] : [followed, opposing];

  const hasPeriods =
    periods !== null &&
    (periods.followed.length > 0 || periods.opposing.length > 0);

  return (
    <div className="@container">
      <p className="sr-only">
        {away.displayName} at {home.displayName}, {weekLabel(game)}
      </p>
      <div
        className={cn(
          "grid items-center gap-2 sm:gap-3",
          hasPeriods
            ? "grid-cols-2 gap-y-4 @xl:grid-cols-[1fr_auto_1fr] @xl:gap-x-6"
            : "grid-cols-[1fr_auto_1fr]",
        )}
      >
        <ScoreLine
          team={away}
          emphasis={away === team}
          onReveal={onReveal}
          {...awayFigures}
        />
        <div
          className={cn(
            "flex flex-col items-center gap-2",
            hasPeriods && "order-last col-span-2 @xl:order-none @xl:col-span-1",
          )}
        >
          <p className="font-mono text-xs whitespace-nowrap">{status}</p>
          {hasPeriods && (
            <PeriodGrid game={game} team={team} periods={periods} />
          )}
        </div>
        <ScoreLine
          team={home}
          emphasis={home === team}
          mirrored
          onReveal={onReveal}
          {...homeFigures}
        />
      </div>
    </div>
  );
}

/** Away then home, like the score row. */
function PeriodGrid({
  game,
  team,
  periods,
}: {
  game: TeamGame;
  team: Team;
  periods: SidePeriods;
}) {
  const own = { team, emphasis: true, periods: periods.followed };
  const other = { team: game.opponent, periods: periods.opposing };
  return (
    <Linescore rows={game.homeAway === "home" ? [other, own] : [own, other]} />
  );
}

/**
 * Which side a score row emphasizes and, once `over`, marks as the winner.
 * An unknown score or a tie leads neither. Pass null scores while hidden.
 */
export function sideStanding(
  followed: number | null,
  opposing: number | null,
  over: boolean,
): {
  followed: Pick<SideFigures, "leading" | "won">;
  opposing: Pick<SideFigures, "leading" | "won">;
} {
  if (followed === null || opposing === null) {
    return {
      followed: { leading: false, won: null },
      opposing: { leading: false, won: null },
    };
  }
  const decided = over && followed !== opposing;
  return {
    followed: {
      leading: followed > opposing,
      won: decided ? followed > opposing : null,
    },
    opposing: {
      leading: opposing > followed,
      won: decided ? opposing > followed : null,
    },
  };
}

/**
 * The score row as it stood at a play: score, possession, timeouts left and
 * the quarter grid so far. `revealedId` is the last play whose result is
 * shown, trailing `play` while it is lined up. The winner waits for `over`.
 */
export function figuresAt(
  game: TeamGame,
  drives: Drive[],
  play: Play,
  revealedId: string | null,
  over: boolean,
): {
  followed: Partial<SideFigures>;
  opposing: Partial<SideFigures>;
  periods: SidePeriods;
  status: string;
} {
  const period = play.period ?? 1;
  const score = (revealedId === null
    ? null
    : scoreAfter(drives, revealedId)) ?? { home: 0, away: 0 };
  const timeouts = timeoutsLeft(drives, revealedId, period);
  const points = pointsByPeriod(drives, revealedId, period);
  const ours = game.homeAway;
  const theirs = ours === "home" ? "away" : "home";
  const offense = drives.find((drive) =>
    drive.plays.some((candidate) => candidate.id === play.id),
  )?.offense;
  const standing = sideStanding(score[ours], score[theirs], over);
  return {
    followed: {
      ...standing.followed,
      display: String(score[ours]),
      hasBall: !over && offense === ours,
      timeouts: timeouts[ours],
    },
    opposing: {
      ...standing.opposing,
      display: String(score[theirs]),
      hasBall: !over && offense === theirs,
      timeouts: timeouts[theirs],
    },
    periods: { followed: points[ours], opposing: points[theirs] },
    status: over ? "Final" : playTime(play),
  };
}
