"use client";

import { useMemo, useRef, useState } from "react";
import { LoadFailed, Loading } from "~/components/common/LoadState";
import { SiteHeader } from "~/components/layout/SiteHeader";
import { Bracket } from "~/components/playoffs/Bracket";
import { WeekSchedule } from "~/components/schedule/WeekSchedule";
import {
  StandingsTables,
  type StandingsView,
} from "~/components/standings/StandingsTables";
import { useFavorite } from "~/hooks/useFavorite";
import {
  usePlayoffMarks,
  useSeason,
  useTeams,
  type SeasonData,
} from "~/hooks/useLeague";
import { revealClass, useRevealed } from "~/hooks/useRevealed";
import { useSpoilers } from "~/hooks/useSpoilers";
import { type PlayoffMarks } from "~/lib/playoff-marks.schema";
import { buildBracket } from "~/lib/playoffs";
import { playoffRound } from "~/lib/season-calendar";
import { buildStandings } from "~/lib/standings";
import { teamByAbbreviation } from "~/lib/teams";
import { type TeamRegistry } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";
import { buildLeagueGames, currentWeekNow, settledThrough } from "~/lib/week";

/** The league: the week's games and the standings, once both have loaded. */
export function HomeApp() {
  const season = useSeason();
  const teams = useTeams(season.data?.season.season ?? null);
  const marks = usePlayoffMarks(season.data?.season.season ?? null);
  const error = teams.error ?? season.error;
  if (error && !(teams.data && season.data))
    return <LoadFailed error={error} />;
  if (!teams.data || !season.data) return <Loading />;
  return (
    <HomeView
      registry={teams.data}
      data={season.data}
      marks={marks}
      key={season.data.season.season}
    />
  );
}

interface HomeViewProps {
  registry: TeamRegistry;
  data: SeasonData;
  marks: PlayoffMarks | null;
}

/**
 * The week's games beside the standings, or the bracket for a playoff week.
 * Hovering a game highlights its teams in the standings, and vice versa. Below
 * `lg` they stack, games first.
 */
function HomeView({ registry, data, marks }: HomeViewProps) {
  const { season: seasonFile, weeks } = data;
  const season = seasonFile.season;
  const totalWeeks = seasonFile.totalWeeks;
  const currentWeek = currentWeekNow(seasonFile);
  const spoilers = useSpoilers({
    season,
    totalWeeks,
    settledThrough: settledThrough(seasonFile),
    currentWeek,
  });
  const { through } = spoilers;

  const favorite = useFavorite();
  const favoriteTeamId = favorite
    ? (teamByAbbreviation(registry, favorite)?.teamId ?? null)
    : null;

  // The standings stand where the viewer is. ESPN's seeds and clinch codes
  // describe the present, so they wait for the whole regular season.
  const standings: StandingsView[] = useMemo(() => {
    const reached = {
      ...seasonFile,
      games: seasonFile.games.filter((game) => game.week <= through),
    };
    const shownMarks = through >= totalWeeks ? marks : null;
    return buildStandings(reached, registry).map(
      ({ conference, divisions }) => ({
        conference,
        divisions: divisions.map(({ division, rows }) => ({
          division,
          rows: rows.map(({ team, record }) => ({
            team,
            record,
            mark: shownMarks?.teams[team.teamId] ?? null,
          })),
        })),
      }),
    );
  }, [seasonFile, registry, marks, through, totalWeeks]);
  const games = useMemo(
    () => buildLeagueGames(seasonFile, registry),
    [seasonFile, registry],
  );
  const bracket = useMemo(
    () => buildBracket(seasonFile, registry, marks),
    [seasonFile, registry, marks],
  );

  const [pointed, setPointed] = useState<readonly string[]>([]);
  const highlighted = useMemo(() => new Set(pointed), [pointed]);
  // A viewer behind the league opens on the week after the one they are
  // caught up through.
  const [week, setWeek] = useState(() =>
    through > 0 ? Math.min(currentWeek, through + 1) : currentWeek,
  );
  const isPlayoffWeek = playoffRound(totalWeeks, week) !== null;

  // The body comes in whole, marks and all, under the header already there.
  const bodyRef = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(bodyRef);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      {/* The page title and the schedule heading are for screen readers only.
          Stacked below `lg`, the second section is labelled so the step from
          the week's games into the standings or bracket is marked; side by
          side, each column names itself. */}
      <h1 className="sr-only">{season} NFL Season</h1>
      <SiteHeader
        through={through}
        settledThrough={spoilers.settledThrough}
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        onCatchUp={spoilers.catchUp}
      />

      <div
        ref={bodyRef}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]",
          revealClass(revealed),
        )}
      >
        <section aria-labelledby="schedule">
          <h2 id="schedule" className="sr-only">
            Schedule
          </h2>
          <WeekSchedule
            games={games}
            week={week}
            board={weeks.get(week)?.board ?? []}
            onWeekChange={setWeek}
            currentWeek={currentWeek}
            totalWeeks={totalWeeks}
            isShown={spoilers.isShown}
            isOpen={spoilers.isOpen}
            showsRecordsBefore={spoilers.showsRecordsBefore}
            highlighted={highlighted}
            favoriteTeamId={favoriteTeamId}
            onPoint={setPointed}
          />
        </section>

        {isPlayoffWeek ? (
          <section aria-labelledby="bracket" className="lg:sticky lg:top-6">
            <h2
              id="bracket"
              className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] lg:sr-only"
            >
              Playoff bracket
            </h2>
            <Bracket
              bracket={bracket}
              totalWeeks={totalWeeks}
              isShown={spoilers.isShown}
              isOpen={spoilers.isOpen}
              favoriteTeamId={favoriteTeamId}
            />
          </section>
        ) : (
          <section aria-labelledby="standings" className="lg:sticky lg:top-6">
            <h2
              id="standings"
              className="text-ink-muted mb-3 text-xs font-semibold tracking-[0.14em] lg:sr-only"
            >
              Standings
            </h2>
            <StandingsTables
              standings={standings}
              showSpoilers={through > 0}
              highlighted={highlighted}
              favoriteTeamId={favoriteTeamId}
              onPoint={setPointed}
            />
          </section>
        )}
      </div>
    </div>
  );
}
