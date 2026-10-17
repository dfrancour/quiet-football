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
import { buildBracket } from "~/lib/playoffs";
import { playoffRound, weekParam } from "~/lib/season-calendar";
import { buildStandings } from "~/lib/standings";
import { teamByAbbreviation } from "~/lib/teams";
import { type TeamRegistry } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";
import {
  buildLeagueGames,
  currentWeekNow,
  settledThrough,
  weekInProgress,
} from "~/lib/week";

/** The league: the week's games and the standings, once both have loaded. */
export function HomeApp() {
  const season = useSeason();
  const teams = useTeams(season.data?.season.season ?? null);
  const error = teams.error ?? season.error;
  if (error && !(teams.data && season.data))
    return <LoadFailed error={error} />;
  if (!teams.data || !season.data) return <Loading />;
  return (
    <HomeView
      registry={teams.data}
      data={season.data}
      key={season.data.season.season}
    />
  );
}

interface HomeViewProps {
  registry: TeamRegistry;
  data: SeasonData;
}

type Pane = "games" | "table";

/** Below `lg`, one of the two at a time, chosen here. */
function PaneSwitch({
  pane,
  tableName,
  onChange,
}: {
  pane: Pane;
  tableName: string;
  onChange: (pane: Pane) => void;
}) {
  const tab = (value: Pane, name: string) => (
    <button
      type="button"
      aria-pressed={pane === value}
      onClick={() => onChange(value)}
      className={cn(
        "flex-1 cursor-pointer rounded-md py-2 text-sm font-semibold transition-colors",
        pane === value
          ? "bg-surface-raised text-ink"
          : "text-ink-faint hover:text-ink-muted",
      )}
    >
      {name}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Show"
      className="border-edge flex shrink-0 gap-1 rounded-lg border p-1 lg:hidden"
    >
      {tab("games", "Schedule")}
      {tab("table", tableName)}
    </div>
  );
}

/**
 * The week's games beside the standings, or the bracket for a playoff week.
 * Hovering a game highlights its teams in the standings, and vice versa. Below
 * `lg` there is room for one: a switch above shows the games or the table,
 * and the page is the viewport, with only the one shown scrolling beneath the
 * header and switch.
 */
function HomeView({ registry, data }: HomeViewProps) {
  const { season: seasonFile, weeks } = data;
  const season = seasonFile.season;
  const totalWeeks = seasonFile.totalWeeks;
  const currentWeek = currentWeekNow(seasonFile);
  const spoilers = useSpoilers({
    season,
    totalWeeks,
    settledThrough: settledThrough(seasonFile),
    currentWeek,
    inProgress: useMemo(() => weekInProgress(seasonFile), [seasonFile]),
  });
  const { through } = spoilers;

  const favorite = useFavorite();
  const favoriteTeamId = favorite
    ? (teamByAbbreviation(registry, favorite)?.teamId ?? null)
    : null;

  // A viewer behind the league opens on the week after the one they are
  // caught up through.
  const [week, setWeek] = useState(() =>
    through > 0 ? Math.min(currentWeek, through + 1) : currentWeek,
  );
  const isPlayoffWeek = playoffRound(totalWeeks, week) !== null;

  // ESPN's seeds and clinch codes describe the present, so the standings
  // wait for the whole regular season; the bracket is seeded by them. Until
  // either can show them, they are not asked for.
  const marks = usePlayoffMarks(season, through >= totalWeeks || isPlayoffWeek);

  // The standings stand where the viewer is.
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
  const [pane, setPane] = useState<Pane>("games");
  const tableName = isPlayoffWeek ? "Bracket" : "Standings";
  // From lg up both are shown and the page scrolls; below, the one chosen,
  // scrolling on its own.
  const paneClass = (value: Pane) =>
    cn(
      "max-lg:relative max-lg:min-h-0 max-lg:self-stretch max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:pb-6",
      pane !== value && "max-lg:hidden",
    );

  // The body comes in whole, marks and all, under the header already there.
  const bodyRef = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(bodyRef);

  return (
    <div className="max-lg:h-viewport mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 lg:pb-6">
      {/* The page title and the section headings are for screen readers
          only: side by side, each column names itself, and below `lg` the
          switch does. */}
      <h1 className="sr-only">{season} NFL Season</h1>
      <SiteHeader
        through={through}
        settledThrough={spoilers.settledThrough}
        currentWeek={currentWeek}
        totalWeeks={totalWeeks}
        partial={spoilers.partial}
        onCatchUp={spoilers.catchUp}
      />

      <div
        ref={bodyRef}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-5 max-lg:min-h-0 max-lg:flex-1 max-lg:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]",
          revealClass(revealed),
        )}
      >
        <PaneSwitch pane={pane} tableName={tableName} onChange={setPane} />
        <section
          aria-labelledby="schedule"
          // The week stepper sits at the foot of the pane, so no space below.
          className={cn(paneClass("games"), "max-sm:pb-0")}
        >
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
          <section
            aria-labelledby="bracket"
            className={cn("lg:sticky lg:top-6", paneClass("table"))}
          >
            <h2 id="bracket" className="sr-only">
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
          <section
            aria-labelledby="standings"
            className={cn("lg:sticky lg:top-6", paneClass("table"))}
          >
            <h2 id="standings" className="sr-only">
              Standings
            </h2>
            <StandingsTables
              standings={standings}
              showSpoilers={through > 0}
              highlighted={highlighted}
              favoriteTeamId={favoriteTeamId}
              onPoint={setPointed}
              week={weekParam(totalWeeks, week)}
            />
          </section>
        )}
      </div>
    </div>
  );
}
