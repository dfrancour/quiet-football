import {
  addOutcome,
  isRegularSeason,
  NO_RECORD,
  outcomeOf,
  type TeamRecord,
} from "~/lib/season";
import { CONFERENCE_ORDER } from "~/lib/teams";
import { type GameOutcome, type SeasonFile } from "~/lib/season.schema";
import {
  type Conference,
  type Division,
  type Team,
  type TeamRegistry,
} from "~/lib/teams.schema";

export interface StandingsRow {
  team: Team;
  record: TeamRecord;
  /** Ties count as half a win, as the NFL computes it. */
  pct: number;
  divisionRecord: TeamRecord;
  conferenceRecord: TeamRecord;
  /** By opponent team id. */
  headToHead: ReadonlyMap<string, TeamRecord>;
}

export interface DivisionStandings {
  division: Division;
  rows: StandingsRow[];
}

export interface ConferenceStandings {
  conference: Conference;
  divisions: DivisionStandings[];
}

const DIVISION_ORDER: readonly Division[] = ["North", "East", "South", "West"];

export function gamesPlayed(record: TeamRecord): number {
  return record.wins + record.losses + record.ties;
}

export function winPct(record: TeamRecord): number {
  const games = gamesPlayed(record);
  return games === 0 ? 0 : (record.wins + record.ties / 2) / games;
}

/** Each team's record against the opponents both have played. */
function commonGames(
  a: StandingsRow,
  b: StandingsRow,
): [TeamRecord, TeamRecord] {
  let own = NO_RECORD;
  let other = NO_RECORD;
  for (const [opponentId, record] of a.headToHead) {
    if (opponentId === b.team.teamId) continue;
    const theirs = b.headToHead.get(opponentId);
    if (!theirs) continue;
    own = combine(own, record);
    other = combine(other, theirs);
  }
  return [own, other];
}

function combine(a: TeamRecord, b: TeamRecord): TeamRecord {
  return {
    wins: a.wins + b.wins,
    losses: a.losses + b.losses,
    ties: a.ties + b.ties,
  };
}

/**
 * Win percentage, then the NFL's division tiebreakers: head-to-head, division
 * record, common games, conference record. It stops there and compares
 * pairwise, so a deep three-way tie can differ from the official table.
 */
function compareRows(a: StandingsRow, b: StandingsRow): number {
  const meetings = a.headToHead.get(b.team.teamId);
  const headToHead =
    meetings && gamesPlayed(meetings) > 0 ? 0.5 - winPct(meetings) : 0;
  const [aCommon, bCommon] = commonGames(a, b);
  return (
    b.pct - a.pct ||
    headToHead ||
    winPct(b.divisionRecord) - winPct(a.divisionRecord) ||
    winPct(bCommon) - winPct(aCommon) ||
    winPct(b.conferenceRecord) - winPct(a.conferenceRecord) ||
    b.record.wins - a.record.wins ||
    a.team.displayName.localeCompare(b.team.displayName)
  );
}

/**
 * Derived from the regular season's finals, so it cannot disagree with a team
 * page.
 */
export function buildStandings(
  season: SeasonFile,
  registry: TeamRegistry,
): ConferenceStandings[] {
  const teamsById = new Map(registry.teams.map((team) => [team.teamId, team]));
  const outcomes = new Map<string, GameOutcome[]>();
  const divisionRecords = new Map<string, TeamRecord>();
  const conferenceRecords = new Map<string, TeamRecord>();
  const headToHead = new Map<string, Map<string, TeamRecord>>();

  const finals = season.games
    .filter((game) => game.status === "final" && isRegularSeason(season, game))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));

  for (const game of finals) {
    const { home, away } = game;
    if (home.score === null || away.score === null) continue;

    const homeTeam = teamsById.get(home.teamId);
    const awayTeam = teamsById.get(away.teamId);
    const sameConference =
      homeTeam !== undefined &&
      awayTeam !== undefined &&
      homeTeam.conference === awayTeam.conference;
    const sameDivision =
      sameConference && homeTeam.division === awayTeam.division;

    for (const [side, other] of [
      [home, away],
      [away, home],
    ] as const) {
      const outcome = outcomeOf(side.score ?? 0, other.score ?? 0);
      outcomes.set(side.teamId, [
        ...(outcomes.get(side.teamId) ?? []),
        outcome,
      ]);
      const meetings =
        headToHead.get(side.teamId) ?? new Map<string, TeamRecord>();
      meetings.set(
        other.teamId,
        addOutcome(meetings.get(other.teamId) ?? NO_RECORD, outcome),
      );
      headToHead.set(side.teamId, meetings);
      if (sameConference) {
        conferenceRecords.set(
          side.teamId,
          addOutcome(conferenceRecords.get(side.teamId) ?? NO_RECORD, outcome),
        );
      }
      if (sameDivision) {
        divisionRecords.set(
          side.teamId,
          addOutcome(divisionRecords.get(side.teamId) ?? NO_RECORD, outcome),
        );
      }
    }
  }

  const rowFor = (team: Team): StandingsRow => {
    const played = outcomes.get(team.teamId) ?? [];
    const record = played.reduce(addOutcome, NO_RECORD);

    return {
      team,
      record,
      pct: winPct(record),
      divisionRecord: divisionRecords.get(team.teamId) ?? NO_RECORD,
      conferenceRecord: conferenceRecords.get(team.teamId) ?? NO_RECORD,
      headToHead: headToHead.get(team.teamId) ?? new Map(),
    };
  };

  return CONFERENCE_ORDER.map((conference) => ({
    conference,
    divisions: DIVISION_ORDER.map((division) => ({
      division,
      rows: registry.teams
        .filter(
          (team) =>
            team.conference === conference && team.division === division,
        )
        .map(rowFor)
        .sort(compareRows),
    })),
  }));
}
