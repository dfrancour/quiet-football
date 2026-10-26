import { isOnField, lineToGain, type FieldSide } from "~/lib/field";
import {
  scoreboardSchema,
  type GameState,
  type LiveScore,
  type BoardGame,
  type FieldState,
  type Scoreboard,
  type SituationState,
} from "~/lib/score.schema";

export type Competition = NonNullable<
  NonNullable<Scoreboard["events"]>[number]["competitions"]
>[number];
export type Competitor = NonNullable<Competition["competitors"]>[number];

type RawScore = Parameters<typeof readScore>[0];

/** Collapses ESPN's three score encodings into a number. */
export function readScore(
  raw:
    | string
    | number
    | { value?: number | undefined; displayValue?: string | undefined }
    | null
    | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw.value === "number" && Number.isFinite(raw.value)) {
    return raw.value;
  }
  if (typeof raw.displayValue === "string") {
    const parsed = Number(raw.displayValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readState(state: string | null | undefined): GameState {
  if (state === "in") return "in";
  if (state === "post") return "post";
  return "pre";
}

/** Points per period in order; ESPN may list them out of order. */
export function readPeriods(competitor: Competitor): number[] {
  return (competitor.linescores ?? [])
    .flatMap((line) =>
      typeof line.value === "number"
        ? [{ period: line.period ?? 0, value: line.value }]
        : [],
    )
    .sort((a, b) => a.period - b.period)
    .map((line) => line.value);
}

function competitorId(competitor: Competitor): string | null {
  const id = competitor.id ?? competitor.team?.id;
  return id === null || id === undefined ? null : String(id);
}

/**
 * Drops the notes ESPN leads play text with: the formation, "(Shotgun)", and
 * sometimes the clock before it, "(10:57) (Shotgun)".
 */
export function cleanPlayText(text: string | null | undefined): string | null {
  const cleaned = text?.replace(/^(\s*\([^)]*\))+\s*/, "").trim();
  return cleaned ? cleaned : null;
}

type Situation = NonNullable<Competition["situation"]>;

function readSide(competitor: Competitor): FieldSide | null {
  if (competitor.homeAway === "home") return "home";
  if (competitor.homeAway === "away") return "away";
  return null;
}

/**
 * The last play's drive start is used only when that side still has the ball;
 * after a change of possession it describes the drive that just ended.
 */
function readField(
  situation: Situation,
  offenseCompetitor: Competitor | null,
): FieldState | null {
  if (!offenseCompetitor) return null;
  const offense = readSide(offenseCompetitor);
  const ballOn = situation.yardLine;
  if (!offense || !isOnField(ballOn)) return null;

  const snapPending =
    Boolean(situation.downDistanceText) &&
    typeof situation.down === "number" &&
    situation.down >= 1 &&
    typeof situation.distance === "number";

  const lastPlay = situation.lastPlay;
  const sameDrive =
    lastPlay?.team?.id !== null &&
    lastPlay?.team?.id !== undefined &&
    String(lastPlay.team.id) === competitorId(offenseCompetitor);
  const driveStart = sameDrive ? lastPlay.drive?.start?.yardLine : null;

  return {
    offense,
    ballOn,
    lineToGain:
      snapPending && typeof situation.distance === "number"
        ? lineToGain(ballOn, situation.distance, offense)
        : null,
    driveSpots:
      isOnField(driveStart) && driveStart !== ballOn
        ? [driveStart, ballOn]
        : [ballOn],
  };
}

/**
 * Orients ESPN's situation to the followed team. Possession is absent between
 * possessions, which reads as nobody having the ball.
 */
function readSituation(
  competition: Competition,
  team: Competitor,
  opponent: Competitor,
): SituationState | null {
  const situation = competition.situation;
  if (!situation) return null;

  const possessionId =
    situation.possession === null || situation.possession === undefined
      ? null
      : String(situation.possession);
  const possession =
    possessionId === null
      ? null
      : possessionId === competitorId(team)
        ? "team"
        : possessionId === competitorId(opponent)
          ? "opponent"
          : null;

  const timeoutsFor = (competitor: Competitor) =>
    (competitor.homeAway === "home"
      ? situation.homeTimeouts
      : competitor.homeAway === "away"
        ? situation.awayTimeouts
        : null) ?? null;

  return {
    downDistance: situation.downDistanceText?.trim() || null,
    possession,
    isRedZone: possession !== null && situation.isRedZone === true,
    timeouts: { team: timeoutsFor(team), opponent: timeoutsFor(opponent) },
    lastPlay: cleanPlayText(situation.lastPlay?.text),
    drive: situation.lastPlay?.drive?.description?.trim() || null,
    field: readField(
      situation,
      possession === "team"
        ? team
        : possession === "opponent"
          ? opponent
          : null,
    ),
  };
}

function readClock(competition: Competition) {
  const status = competition.status;
  const statusType = status?.type;
  return {
    state: readState(statusType?.state),
    detail:
      statusType?.shortDetail ??
      statusType?.detail ??
      statusType?.description ??
      "Scheduled",
    period: typeof status?.period === "number" ? status.period : null,
    clock: status?.displayClock ?? null,
    completed: statusType?.completed === true,
  };
}

function lastPlayId(competition: Competition): string | null {
  const id = competition.situation?.lastPlay?.id;
  return id === null || id === undefined ? null : String(id);
}

/** Every game on the scoreboard; a malformed payload reads as empty. */
export function extractScoreboard(payload: unknown): BoardGame[] {
  const parsed = scoreboardSchema.safeParse(payload);
  if (!parsed.success) return [];

  return (parsed.data.events ?? []).flatMap((event) => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const home = competitors.find((entry) => entry.homeAway === "home");
    const away = competitors.find((entry) => entry.homeAway === "away");
    const gameId = String(event.id);
    if (!competition || !home || !away) return [];

    const side = (competitor: Competitor) => ({
      abbreviation: competitor.team?.abbreviation?.toUpperCase() ?? "???",
      score: readScore(competitor.score),
    });

    return [
      {
        gameId,
        ...readClock(competition),
        lastPlayId: lastPlayId(competition),
        home: side(home),
        away: side(away),
      },
    ];
  });
}

/** A team's side of a game and the other side; null if it does not play in it. */
function sidesFor(
  competition: Competition,
  teamAbbreviation: string,
): { team: Competitor; opponent: Competitor; target: string } | null {
  const target = teamAbbreviation.toUpperCase();
  const competitors = competition.competitors ?? [];
  const team = competitors.find(
    (competitor) => competitor.team?.abbreviation?.toUpperCase() === target,
  );
  const opponent = competitors.find((competitor) => competitor !== team);
  return team && opponent ? { team, opponent, target } : null;
}

/** A game's situation from one team's side; null if it has none. */
export function teamSituation(
  competition: Competition,
  teamAbbreviation: string,
): SituationState | null {
  const sides = sidesFor(competition, teamAbbreviation);
  return sides ? readSituation(competition, sides.team, sides.opponent) : null;
}

/** Null when the team has no game on the board. */
export function extractTeamScore(
  payload: unknown,
  teamAbbreviation: string,
): LiveScore | null {
  const parsed = scoreboardSchema.safeParse(payload);
  if (!parsed.success) return null;

  for (const event of parsed.data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!competition) continue;
    const sides = sidesFor(competition, teamAbbreviation);
    if (!sides) continue;
    const { team, opponent, target } = sides;

    return {
      gameId: String(event.id),
      ...readClock(competition),
      team: {
        abbreviation: team.team?.abbreviation?.toUpperCase() ?? target,
        score: readScore(team.score),
        periods: readPeriods(team),
      },
      opponent: {
        abbreviation: opponent.team?.abbreviation?.toUpperCase() ?? "???",
        score: readScore(opponent.score),
        periods: readPeriods(opponent),
      },
      situation: readSituation(competition, team, opponent),
    };
  }

  return null;
}

/** Q1–Q4, then OT, 2OT for each extra period. */
export function periodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return period === 5 ? "OT" : `${period - 4}OT`;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

/** "2nd Quarter", "Overtime", "2nd Overtime". */
export function periodName(period: number): string {
  const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`;
  if (period <= 4) return `${ordinal(period)} Quarter`;
  return period === 5 ? "Overtime" : `${ordinal(period - 4)} Overtime`;
}

/**
 * "Q4 - 00:47" when ESPN's detail reads like "0:47 - 4th"; breaks
 * ("Halftime", "End of 3rd") and anything unrecognised keep ESPN's wording.
 */
export function formatGameClock(
  score: Pick<LiveScore, "detail" | "period" | "clock">,
): string {
  const { detail, period, clock } = score;
  const inPeriod = /^\d{1,2}:\d{2} - /.test(detail);
  const [, minutes, seconds] = clock?.match(/^(\d{1,2}):(\d{2})$/) ?? [];
  if (!inPeriod || period === null || period < 1 || !minutes || !seconds) {
    return detail;
  }
  return `${periodLabel(period)} - ${minutes.padStart(2, "0")}:${seconds}`;
}

export type { RawScore };
