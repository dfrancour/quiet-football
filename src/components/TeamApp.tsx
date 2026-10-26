"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoadFailed, Loading } from "~/components/common/LoadState";
import { ByeWeek } from "~/components/game/ByeWeek";
import { GameDetail } from "~/components/game/GameDetail";
import { AppHeader } from "~/components/layout/AppHeader";
import { ScheduleSelector } from "~/components/schedule/ScheduleSelector";
import { ScheduleSwitcher } from "~/components/schedule/ScheduleSwitcher";
import { useFullScreen, useFullScreenEnabled } from "~/hooks/useFullScreen";
import { useSeason, useTeams, type SeasonData } from "~/hooks/useLeague";
import { useNow } from "~/hooks/useNow";
import { usePlayByPlay } from "~/hooks/usePlayByPlay";
import { useRecaps } from "~/hooks/useRecaps";
import { useSideways } from "~/hooks/useSideways";
import { revealClass, useRevealed } from "~/hooks/useRevealed";
import { useSpoilers } from "~/hooks/useSpoilers";
import { useWatchProgressByGame } from "~/hooks/useWatchProgress";
import { situationAfter } from "~/lib/game-situations";
import { type PlayByPlay } from "~/lib/plays.schema";
import { playByPlayQuery } from "~/lib/queries";
import { standingsPath, teamPath } from "~/lib/routes";
import { defaultGameId, gamePhase } from "~/lib/schedule";
import { parseWeekParam, weekParam } from "~/lib/season-calendar";
import { extractTeamScore } from "~/lib/score";
import { buildTeamSchedule, teamGameRecords } from "~/lib/team-view";
import { teamByAbbreviation } from "~/lib/teams";
import { type Team, type TeamRegistry } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";
import { currentWeekNow, settledThrough, weekInProgress } from "~/lib/week";

/** One team's season, once the league has loaded; an unknown team goes to the standings. */
export function TeamApp({ abbreviation }: { abbreviation: string }) {
  const router = useRouter();
  const season = useSeason();
  const teams = useTeams(season.data?.season.season ?? null);
  const team = teams.data
    ? teamByAbbreviation(teams.data, decodeURIComponent(abbreviation))
    : undefined;
  useEffect(() => {
    if (team === null) router.replace(standingsPath());
  }, [team, router]);

  const error = teams.error ?? season.error;
  if (error && !(teams.data && season.data))
    return <LoadFailed error={error} about={false} />;
  if (!teams.data || !season.data || !team) return <Loading about={false} />;
  return (
    <TeamView
      registry={teams.data}
      data={season.data}
      team={team}
      key={`${season.data.season.season}-${team.abbreviation}`}
    />
  );
}

interface TeamViewProps {
  registry: TeamRegistry;
  data: SeasonData;
  team: Team;
}

/**
 * `ScheduleSelector` on the left drives `GameDetail` on the right. The
 * selection is `pickedGameId ?? default`, so an explicit pick sticks as the
 * default moves; `?week=` is the first pick.
 */
function TeamView({ registry, data, team }: TeamViewProps) {
  const { season: seasonFile, weeks } = data;
  const season = seasonFile.season;
  const now = useNow();
  const client = useQueryClient();

  const [expanded, toggleExpanded] = useFullScreen();
  const fullScreenEnabled = useFullScreenEnabled();
  const sideways = useSideways();

  const spoilers = useSpoilers({
    season,
    totalWeeks: seasonFile.totalWeeks,
    settledThrough: settledThrough(seasonFile),
    currentWeek: currentWeekNow(seasonFile),
    inProgress: useMemo(() => weekInProgress(seasonFile), [seasonFile]),
  });
  const { isOpen, recordThrough, recordsAt } = spoilers;

  const fullSchedule = useMemo(
    () => buildTeamSchedule(seasonFile, registry, team.teamId),
    [seasonFile, registry, team.teamId],
  );
  // A playoff game the viewer may not see yet is left out altogether: its
  // being there says the team won the round before.
  const schedule = useMemo(
    () => ({
      ...fullSchedule,
      games: fullSchedule.games.filter((game) => isOpen(game.gate)),
    }),
    [fullSchedule, isOpen],
  );

  // Null follows the default; an explicit pick sticks as the default moves.
  // A bye week can be picked too, and shows nothing but itself.
  const weekQuery = useSearchParams().get("week") ?? undefined;
  const [pick, setPick] = useState<{ gameId: string } | { bye: number } | null>(
    () => {
      const week = parseWeekParam(seasonFile.totalWeeks, weekQuery);
      if (week === null) return null;
      const game = fullSchedule.games.find((entry) => entry.week === week);
      if (game) return { gameId: game.gameId };
      return fullSchedule.byeWeeks.includes(week) ? { bye: week } : null;
    },
  );
  const pickedGameId = pick && "gameId" in pick ? pick.gameId : null;
  const selectedBye = pick && "bye" in pick ? pick.bye : null;
  // A pick is kept in the URL, in place, so a reload lands on it again.
  const totalWeeks = seasonFile.totalWeeks;
  const abbreviation = team.abbreviation;
  const showWeek = useCallback(
    (week: number) =>
      window.history.replaceState(
        null,
        "",
        teamPath(abbreviation, weekParam(totalWeeks, week)),
      ),
    [abbreviation, totalWeeks],
  );
  const selectGame = useCallback(
    (gameId: string) => {
      setPick({ gameId });
      const game = fullSchedule.games.find((entry) => entry.gameId === gameId);
      if (game) showWeek(game.week);
    },
    [fullSchedule.games, showWeek],
  );
  const selectBye = useCallback(
    (bye: number) => {
      setPick({ bye });
      showWeek(bye);
    },
    [showWeek],
  );

  const record = useMemo(
    () => recordThrough(schedule.games),
    [recordThrough, schedule.games],
  );

  const openingGameId = useMemo(
    () => defaultGameId(schedule, now),
    [schedule, now],
  );

  // A pick that is covered (a playoff URL, say) falls back to the default.
  const picked =
    schedule.games.find((game) => game.gameId === pickedGameId) ?? null;
  const selectedGameId =
    selectedBye !== null ? null : (picked?.gameId ?? openingGameId);
  const selectedGame =
    schedule.games.find((game) => game.gameId === selectedGameId) ?? null;
  const recaps = useRecaps(seasonFile, registry, selectedGame);
  // Records reveal games the viewer did not uncover.
  const records = useMemo(
    () =>
      selectedGame &&
      teamGameRecords(
        seasonFile,
        team.teamId,
        selectedGame,
        recordsAt(selectedGame),
      ),
    [seasonFile, team.teamId, selectedGame, recordsAt],
  );

  const selectedPhase =
    now !== null && selectedGame !== null ? gamePhase(selectedGame, now) : null;
  const selectedIsLive = selectedPhase === "live";

  // The selected game's score and situation, from its week's scoreboard,
  // which is polled while a game in it is under way.
  const selectedWeek = selectedGame ? weeks.get(selectedGame.week) : undefined;
  const score = useMemo(
    () =>
      selectedWeek
        ? extractTeamScore(selectedWeek.payload, team.abbreviation)
        : null,
    [selectedWeek, team.abbreviation],
  );

  // The plays are asked for only when they will be drawn: the game is
  // shown, the viewer has a place in it, or they asked to watch it. A
  // covered game nobody has started costs ESPN nothing. A live game's are
  // read again as the scoreboard shows a new play.
  const progress = useWatchProgressByGame();
  const [asked, setAsked] = useState<ReadonlySet<string>>(() => new Set());
  const playable = selectedIsLive || selectedPhase === "final";
  // A phone on its side is held to watch: a game with plays has the screen.
  const watching = sideways && playable && selectedBye === null;
  // No header or schedule: full screen, or watching.
  const bare = expanded || watching;
  const playsWanted =
    playable &&
    selectedGame !== null &&
    (spoilers.isShown(selectedGame) ||
      selectedGame.gameId in progress ||
      asked.has(selectedGame.gameId));
  const loadPlays = useCallback(async (): Promise<PlayByPlay | null> => {
    if (selectedGameId === null) return null;
    setAsked((before) => new Set(before).add(selectedGameId));
    return client.query(playByPlayQuery(selectedGameId, selectedIsLive));
  }, [client, selectedGameId, selectedIsLive]);
  const scoreMark = score
    ? [
        score.detail,
        score.team.score,
        score.opponent.score,
        score.situation?.lastPlay,
      ].join("|")
    : null;
  const playByPlay = usePlayByPlay(
    playsWanted ? selectedGameId : null,
    selectedIsLive,
    scoreMark,
  );
  // Read as the panel draws, so each poll's note is there by the next.
  const situationAfterPlay = useCallback(
    (playId: string) =>
      selectedGameId === null
        ? null
        : situationAfter(selectedGameId, playId, team.abbreviation),
    [selectedGameId, team.abbreviation],
  );

  // The body comes in whole, marks and all, under the header already there.
  const bodyRef = useRef<HTMLDivElement>(null);
  const revealed = useRevealed(bodyRef);

  return (
    // From md up the page is the viewport, the schedule a rail beside the
    // game, and each column scrolls on its own. Below md the game has the
    // page to itself, the schedule is a bar along the bottom, and the page
    // scrolls, clear of the bar at its end. Watching on a phone on its side,
    // the game is the viewport, and nothing else is drawn.
    <div
      className={cn(
        "mx-auto flex w-full flex-col px-4",
        watching
          ? "h-viewport max-w-7xl py-2"
          : cn(
              "gap-6 md:h-dvh",
              // Same width as the league page.
              expanded ? "max-w-7xl py-4" : "max-w-6xl py-6 max-md:pb-20",
            ),
      )}
    >
      {!bare && (
        <AppHeader
          team={schedule.team}
          record={record}
          through={spoilers.through}
          showAll={spoilers.showAll}
          onShowAll={spoilers.setShowAll}
          settledThrough={spoilers.settledThrough}
          currentWeek={spoilers.currentWeek}
          totalWeeks={spoilers.totalWeeks}
          partial={spoilers.partial}
          onCatchUp={spoilers.catchUp}
        />
      )}

      <div
        ref={bodyRef}
        className={cn(
          "grid gap-x-8 gap-y-6",
          watching
            ? "min-h-0 flex-1 grid-rows-[minmax(0,1fr)]"
            : "items-start md:min-h-0 md:flex-1 md:grid-rows-[minmax(0,1fr)]",
          !bare && "md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]",
          revealClass(revealed),
        )}
      >
        {!bare && (
          <div className="border-edge hidden md:flex md:max-h-full md:flex-col md:border-r md:pr-5">
            <ScheduleSelector
              schedule={schedule}
              selectedGameId={selectedGameId}
              selectedBye={selectedBye}
              onSelect={selectGame}
              onSelectBye={selectBye}
              isShown={spoilers.isShown}
              now={now}
            />
          </div>
        )}

        <div
          className={
            watching
              ? "flex min-h-0 flex-col"
              : "md:flex md:max-h-full md:flex-col md:overflow-y-auto md:overscroll-contain"
          }
        >
          {!bare && (
            <div className="md:hidden">
              <ScheduleSwitcher
                schedule={schedule}
                selectedGame={selectedGame}
                selectedBye={selectedBye}
                onSelect={selectGame}
                onSelectBye={selectBye}
                isShown={spoilers.isShown}
                now={now}
              />
            </div>
          )}
          {selectedBye !== null ? (
            <ByeWeek week={selectedBye} />
          ) : (
            <GameDetail
              game={selectedGame}
              now={now}
              team={schedule.team}
              score={score}
              scoreError={selectedWeek?.error?.message ?? null}
              scoreUpdatedAt={selectedWeek ? selectedWeek.fetchedAt : null}
              showSpoilers={
                selectedGame !== null && spoilers.isShown(selectedGame)
              }
              records={records}
              recaps={recaps}
              playByPlay={playByPlay}
              situationAfter={situationAfterPlay}
              onLoadPlays={playable && !playsWanted ? loadPlays : undefined}
              expanded={expanded}
              // Watching already hides all the page can; only the browser's
              // full screen has more to hide.
              onToggleExpanded={
                watching && !expanded && !fullScreenEnabled
                  ? undefined
                  : toggleExpanded
              }
              sideways={watching}
            />
          )}
        </div>
      </div>
    </div>
  );
}
