import {
  FIELD_YARDS,
  forward,
  isOnField,
  lineToGain,
  type FieldSide,
  type HomeYardLine,
} from "~/lib/field";
import {
  summarySchema,
  type Drive,
  type Play,
  type PlayAction,
  type PlayKind,
  type PlayOutcome,
  type Series,
  type Summary,
} from "~/lib/plays.schema";
import { type ReplayStage } from "~/lib/replay";
import { cleanPlayText, periodName } from "~/lib/score";
import { type FieldState } from "~/lib/score.schema";

export const SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";

type RawDrive = NonNullable<NonNullable<Summary["drives"]>["current"]>;
type RawPlay = NonNullable<RawDrive["plays"]>[number];

const OFFICIAL_TIMEOUT = "74";

/**
 * Play types that stop the game without a snap: End Period, Timeout, End of
 * Half, End of Game, Coin Toss, Two-Minute Warning. These carry a down and a
 * spot like any snap, so the type is the only way to tell them apart.
 */
const STOPPAGES = new Set(["2", "21", "65", "66", "70", "75"]);

function playKind(play: RawPlay): PlayKind {
  const typeId = play.type?.id == null ? null : String(play.type.id);
  if (typeId !== null && STOPPAGES.has(typeId)) return "stoppage";
  const down = play.start?.down;
  return typeof down === "number" && down >= 1 && down <= 4 ? "snap" : "kick";
}

/**
 * What the offense tried, from ESPN's play type. A penalty or fumble recovery
 * type names only the result, so the play text decides.
 */
function playAction(type: string, text: string): PlayAction | null {
  if (/kickoff/i.test(type)) return "kickoff";
  if (/punt/i.test(type)) return "punt";
  if (/field goal/i.test(type)) return "fieldGoal";
  if (/pass|sack|interception/i.test(type)) return "pass";
  if (/rush/i.test(type)) return "run";
  if (/\bpass\b|\bsacked\b/i.test(text)) return "pass";
  if (
    /\b(up the middle|(left|right) (end|tackle|guard)|scrambles|kneels)\b/i.test(
      text,
    )
  ) {
    return "run";
  }
  // A carry with no gap named still reports its yards; a penalty before the
  // snap reports only its enforcement.
  if (/\bfor (-?\d+ yards?|no gain)\b/i.test(text)) return "run";
  return null;
}

/**
 * A score takes precedence, so a returned interception reads as a touchdown.
 *
 * ESPN does not flag every turnover (a muffed kickoff the kicking side
 * recovers), but its text capitalizes a change of possession: "RECOVERED by"
 * and "INTERCEPTED"; a side keeping its own fumble is "recovered by".
 */
function playOutcome(
  play: RawPlay,
  action: PlayAction | null,
  text: string,
): PlayOutcome | null {
  const type = play.type?.text ?? "";
  if (play.scoringPlay === true) {
    if (/touchdown/i.test(type) || /\bTOUCHDOWN\b/i.test(text)) {
      return "touchdown";
    }
    if (/safety/i.test(type) || /\bSAFETY\b/i.test(text)) return "safety";
    if (action === "fieldGoal") return "fieldGoal";
  }
  if (action === "fieldGoal") return "noGood";
  if (/intercept/i.test(type) || /\bINTERCEPTED\b/.test(text)) {
    return "interception";
  }
  if (
    (play.isTurnover === true && /fumble|muff/i.test(type)) ||
    /\bRECOVERED by\b/.test(text)
  ) {
    return "fumble";
  }
  if (action === "punt") return "punt";
  return null;
}

/** The yards a play itself made, as its text tells them: "for 7 yards". */
function yardsMade(text: string): number | null {
  const told = /\bfor (-?\d+) yards?\b|\bfor (no gain)\b/i.exec(text);
  if (!told) return null;
  return told[2] ? 0 : Number(told[1]);
}

/** "7-yd Run", "Run, No Gain", "Run, 2-yd Loss". */
function gained(kind: string, yards: number | null): string {
  if (yards === null) return kind;
  if (yards > 0) return `${yards}-yd ${kind}`;
  return yards === 0 ? `${kind}, No Gain` : `${kind}, ${-yards}-yd Loss`;
}

/**
 * A short headline like ESPN's feed: "7-yd Run", "Incompletion", "56-yd Punt".
 * Yards come from the text, not ESPN's net, so a run nullified by a penalty
 * still reads as the run. Falls back to ESPN's type name.
 */
function playHeadline(
  play: RawPlay,
  action: PlayAction | null,
  text: string,
): string {
  const type = play.type?.text?.trim() || "Play";

  if (/^TWO-POINT/i.test(text)) return "Two-point Try";
  if (/spiked the ball/i.test(text)) return "Spike";
  if (/\bkneels\b/i.test(text)) return "Kneel";

  if (action === "punt" || action === "kickoff") {
    const kind = action === "punt" ? "Punt" : "Kickoff";
    if (/BLOCKED/.test(text)) return `Blocked ${kind}`;
    const distance = kickDistance(text);
    return distance === null ? kind : `${distance}-yd ${kind}`;
  }
  if (action === "fieldGoal") {
    const distance = /(\d+) yard field goal/i.exec(text)?.[1];
    return distance ? `${distance}-yd Field Goal` : "Field Goal";
  }

  if (action === null && play.isPenalty === true) {
    const called = /PENALTY on [^,]+, ([^,]+?), \d+ yards?/i.exec(text)?.[1];
    return play.penalty?.type?.text?.trim() || called || "Penalty";
  }

  if (/\bINTERCEPTED\b/.test(text)) return "Interception";
  if (/\bsacked\b/i.test(text)) {
    const lost = yardsMade(text);
    return lost ? `${Math.abs(lost)}-yd Sack` : "Sack, No Loss";
  }
  if (/pass incomplete/i.test(text)) return "Incompletion";
  if (action === "run") return gained("Run", yardsMade(text));
  if (action === "pass") return gained("Pass", yardsMade(text));
  return type;
}

/** Gamebook codes in ESPN's play text that differ from the abbreviation. */
const GAMEBOOK_CODES: Record<string, string> = {
  ARZ: "ARI",
  BLT: "BAL",
  CLV: "CLE",
  HST: "HOU",
  JAC: "JAX",
  LA: "LAR",
  WAS: "WSH",
};

type SideOfCode = (code: string) => FieldSide | null;

/**
 * ESPN names the side calling a timeout only in the text; the play's team is
 * always the offense.
 */
function timeoutCaller(text: string, sideOfCode: SideOfCode): FieldSide | null {
  const code = /^Timeout #\d+ by ([A-Z]{2,4})\b/i
    .exec(text)?.[1]
    ?.toUpperCase();
  if (!code) return null;
  return sideOfCode(code) ?? sideOfCode(GAMEBOOK_CODES[code] ?? "");
}

/**
 * A stoppage in the feed's own words rather than ESPN's shouting ("END
 * GAME", "END QUARTER 1"). A timeout's text says who and when, so it stays.
 */
function stoppageHeadline(
  typeId: string | null,
  text: string,
  period: number | null,
): string {
  switch (typeId) {
    case "2":
      return period === null
        ? "End of quarter"
        : `End of ${periodName(period)}`;
    case "65":
      return "Halftime";
    case "66":
      return "End of game";
    case "21":
      return text.replace(/\.$/, "");
    case "75":
      return "Two-minute warning";
    case "70":
      return "Coin toss";
    default:
      return text;
  }
}

function readPlay(play: RawPlay, sideOfCode: SideOfCode): Play | null {
  const text = cleanPlayText(play.text);
  if (!text) return null;
  const kind = playKind(play);
  const { homeScore, awayScore } = play;
  const action =
    kind === "stoppage" ? null : playAction(play.type?.text ?? "", text);
  const placed = kind !== "stoppage";
  const period = play.period?.number ?? null;
  return {
    id: String(play.id),
    kind,
    action,
    outcome: kind === "stoppage" ? null : playOutcome(play, action, text),
    headline:
      kind === "stoppage"
        ? stoppageHeadline(
            play.type?.id == null ? null : String(play.type.id),
            text,
            period,
          )
        : playHeadline(play, action, text),
    timeoutBy: kind === "stoppage" ? timeoutCaller(text, sideOfCode) : null,
    text,
    period,
    clock: play.clock?.displayValue ?? null,
    downDistance:
      kind === "snap" ? play.start?.downDistanceText?.trim() || null : null,
    down: kind === "snap" ? (play.start?.down ?? null) : null,
    distance: kind === "snap" ? (play.start?.distance ?? null) : null,
    start:
      placed && isOnField(play.start?.yardLine) ? play.start.yardLine : null,
    end: placed && isOnField(play.end?.yardLine) ? play.end.yardLine : null,
    scoring: play.scoringPlay === true,
    turnover: play.isTurnover === true,
    penalty: play.isPenalty === true,
    score:
      typeof homeScore === "number" && typeof awayScore === "number"
        ? { home: homeScore, away: awayScore }
        : null,
  };
}

/**
 * Every drive from ESPN's `summary`, oldest first. A malformed payload yields
 * no drives.
 *
 * The drive under way appears both as `current` and as the last of
 * `previous`, so drives are keyed by id. Official timeouts (TV breaks) are
 * dropped.
 */
/** Whether the summary's own header calls the game over. */
export function summaryIsFinal(payload: unknown): boolean {
  const parsed = summarySchema.safeParse(payload);
  return (
    parsed.success &&
    parsed.data.header?.competitions?.[0]?.status?.type?.completed === true
  );
}

export function extractPlayByPlay(payload: unknown): Drive[] {
  const parsed = summarySchema.safeParse(payload);
  if (!parsed.success) return [];

  const competitors = parsed.data.header?.competitions?.[0]?.competitors ?? [];
  const sideOf = (teamId: string | number | null | undefined) => {
    if (teamId === null || teamId === undefined) return null;
    const side = competitors.find(
      (competitor) => String(competitor.id) === String(teamId),
    )?.homeAway;
    return side === "home" || side === "away" ? side : null;
  };
  const sideOfCode = (code: string): FieldSide | null => {
    const competitor = competitors.find(
      (candidate) => candidate.team?.abbreviation?.toUpperCase() === code,
    );
    return competitor ? sideOf(competitor.id) : null;
  };

  const { previous, current } = parsed.data.drives ?? {};
  const byId = new Map<string, RawDrive>();
  for (const drive of [...(previous ?? []), ...(current ? [current] : [])]) {
    byId.set(String(drive.id), drive);
  }
  const currentId = current ? String(current.id) : null;

  return [...byId.values()].map((drive) => {
    const id = String(drive.id);
    const result = drive.displayResult?.trim() || null;
    return {
      id,
      offense: sideOf(drive.team?.id),
      description: drive.description?.trim() || null,
      result,
      isScore: drive.isScore === true,
      inProgress: id === currentId && result === null,
      plays: (drive.plays ?? []).flatMap((play) => {
        if (
          play.type?.id != null &&
          String(play.type.id) === OFFICIAL_TIMEOUT
        ) {
          return [];
        }
        const read = readPlay(play, sideOfCode);
        return read ? [read] : [];
      }),
    };
  });
}

/**
 * Fills `driveSpots` with every snap of the drive under way.
 *
 * Play-by-play and the scoreboard are fetched separately, so the drive is used
 * only if still in progress and owned by the scoreboard's offense. The
 * scoreboard's spot stays last.
 */
export function withDriveSpots(field: FieldState, drives: Drive[]): FieldState {
  const drive = drives.at(-1);
  if (!drive?.inProgress || drive.offense !== field.offense) return field;

  const spots: number[] = [];
  for (const play of drive.plays.filter(isPlacedSnap)) {
    if (play.start !== spots.at(-1)) spots.push(play.start);
  }
  if (spots.length === 0) return field;
  if (spots.at(-1) !== field.ballOn) spots.push(field.ballOn);
  return { ...field, driveSpots: spots };
}

/** Where a snap had to reach for a first down; the goal line when goal to go. */
function lineToGainOf(play: Play, drive: Drive): number | null {
  if (drive.offense === null || play.start === null || play.distance === null) {
    return null;
  }
  return play.start + forward(drive.offense) * play.distance;
}

/**
 * A drive split at each first down, oldest first.
 *
 * A new set begins at a first down whose line to gain has moved: a gain or a
 * defensive penalty moves it, a false start (1st & 10, then 1st & 15) does
 * not. The play before the new set says how it was earned.
 */
export function driveSeries(drive: Drive): Series[] {
  const series: Series[] = [];
  let line: number | null = null;
  let previous: Play | null = null;

  for (const play of drive.plays) {
    const playLine = play.kind === "snap" ? lineToGainOf(play, drive) : null;
    const current = series.at(-1);
    if (!current) {
      series.push({ plays: [play], gainedBy: null });
    } else if (
      play.down === 1 &&
      line !== null &&
      playLine !== null &&
      playLine !== line
    ) {
      series.push({
        plays: [play],
        gainedBy: previous?.penalty ? "penalty" : "play",
      });
    } else {
      current.plays.push(play);
    }
    if (playLine !== null && play.down === 1) line = playLine;
    if (play.kind !== "stoppage") previous = play;
  }
  return series;
}

/**
 * One snap: where it was snapped to where the ball was next spotted, so a
 * penalty moves it just as a run does.
 */
export interface DownStep {
  id: string;
  down: number | null;
  from: HomeYardLine;
  to: HomeYardLine;
  /** Toward the goal the offense is attacking; negative for a loss. */
  yards: number;
  penalty: boolean;
  /** Run or pass, drawn solid or open; null when it cannot be told. */
  action: PlayAction | null;
}

type PlacedSnap = Play & { start: number };

function isPlacedSnap(play: Play): play is PlacedSnap {
  return play.kind === "snap" && play.start !== null;
}

function isKickedSnap(play: Play): boolean {
  return play.action === "punt" || play.action === "fieldGoal";
}

function isSetSnap(play: Play): play is PlacedSnap {
  return isPlacedSnap(play) && !isKickedSnap(play);
}

function downStep(
  snap: PlacedSnap,
  to: HomeYardLine,
  offense: FieldSide,
): DownStep {
  return {
    id: snap.id,
    down: snap.down,
    from: snap.start,
    to,
    yards: offense === "home" ? to - snap.start : snap.start - to,
    penalty: snap.penalty,
    action: snap.action,
  };
}

/**
 * The snaps of the current set of downs, oldest first, the last ending at the
 * ball.
 *
 * Empty when play-by-play does not cover that set: the drive is over or the
 * other side's, or the chains moved and the scoreboard's line to gain no
 * longer matches.
 */
export function currentSet(field: FieldState, drives: Drive[]): DownStep[] {
  const drive = drives.at(-1);
  if (!drive?.inProgress || drive.offense !== field.offense) return [];

  const snaps = (driveSeries(drive).at(-1)?.plays ?? []).filter(isSetSnap);
  const firstDown = [...snaps].reverse().find((snap) => snap.down === 1);
  const goal = field.offense === "home" ? FIELD_YARDS : 0;
  if (
    firstDown &&
    lineToGainOf(firstDown, drive) !== (field.lineToGain ?? goal)
  ) {
    return [];
  }

  return snaps.map((snap, index) =>
    downStep(snap, snaps[index + 1]?.start ?? field.ballOn, field.offense),
  );
}

/** A kick's flight to where it landed, then any return to where it ended. */
export interface KickFlight {
  id: string;
  action: "punt" | "kickoff" | "fieldGoal";
  from: HomeYardLine;
  /** Where it came down; where the play ended when that cannot be told. */
  landed: HomeYardLine;
  /** Where the play left the ball. */
  to: HomeYardLine;
  /** Run back from where it landed, rather than caught, downed or placed. */
  returned: boolean;
}

/** How far a punt or kickoff carried, as its text tells it: "punts 56 yards". */
function kickDistance(text: string): number | null {
  const match = /\b(?:punts|kicks)(?: onside)? (-?\d+) yards?\b/.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * ESPN reports only where the play ended, so the landing comes from the
 * distance in the text. A fair catch or downed ball lands where it ended; a
 * touchback is placed, not returned.
 */
function kickedAway(
  play: Play,
  action: "punt" | "kickoff",
  from: HomeYardLine,
  to: HomeYardLine,
  kicker: FieldSide,
): KickFlight {
  const distance = kickDistance(play.text);
  const landed =
    distance === null
      ? to
      : Math.min(
          FIELD_YARDS + 10,
          Math.max(-10, from + forward(kicker) * distance),
        );
  return {
    id: play.id,
    action,
    from,
    landed,
    to,
    returned: landed !== to && !/touchback/i.test(play.text),
  };
}

/** How the field looked for one play; see `fieldAtPlay`. */
export interface PlayOnField {
  field: FieldState | null;
  set: DownStep[];
  /** A punt, kickoff or field goal try, drawn as an arc rather than a bar. */
  kick: KickFlight | null;
  /** The side the play put points up for. */
  scoredBy: FieldSide | null;
}

/** The posts: on the end line, ten yards past the goal being attacked. */
function postsFor(offense: FieldSide): HomeYardLine {
  return offense === "home" ? FIELD_YARDS + 10 : -10;
}

/**
 * The side whose score rose, or without scores, the offense unless it turned
 * the ball over.
 */
function scoringSide(
  drives: Drive[],
  play: Play,
  offense: FieldSide,
): FieldSide {
  const plays = playsInOrder(drives);
  const before = plays[plays.indexOf(play) - 1];
  const previous = before
    ? (scoreAfter(drives, before.id) ?? { home: 0, away: 0 })
    : { home: 0, away: 0 };
  if (play.score) {
    if (play.score.home > previous.home) return "home";
    if (play.score.away > previous.away) return "away";
  }
  const defense = offense === "home" ? "away" : "home";
  return play.turnover ? defense : offense;
}

/**
 * The field for one play: the line of scrimmage and line to gain it was
 * snapped against, and the set of downs through that snap, the snap last.
 *
 * A punt or field goal try is a kick, not a bar; a kickoff is a kick to where
 * the next drive begins.
 *
 * At the `snap` stage the snap is only lined up: the set stops short of it and
 * nothing is kicked.
 *
 * A non-snap (timeout, end of quarter) shows the snap before it in its drive,
 * or the drive's first snap when it opens the drive.
 */
export function fieldAtPlay(
  drives: Drive[],
  playId: string,
  stage: ReplayStage = "result",
): PlayOnField {
  const nowhere: PlayOnField = {
    field: null,
    set: [],
    kick: null,
    scoredBy: null,
  };
  const drive = drives.find((candidate) =>
    candidate.plays.some((play) => play.id === playId),
  );
  const target = drive?.plays.find((play) => play.id === playId);
  if (!drive?.offense || !target) return nowhere;
  const offense = drive.offense;
  const played = !(stage === "snap" && target.kind === "snap");
  const scoredBy =
    played && target.scoring ? scoringSide(drives, target, offense) : null;

  const snaps = drive.plays.filter(isPlacedSnap);
  let anchor: PlacedSnap | null = null;
  for (const play of drive.plays) {
    if (isPlacedSnap(play)) anchor = play;
    if (play.id === playId) break;
  }

  const fieldAt = (spot: HomeYardLine, snap: Play | null): FieldState => ({
    offense,
    ballOn: spot,
    lineToGain:
      snap?.distance == null ? null : lineToGain(spot, snap.distance, offense),
    driveSpots: [spot],
  });

  if (anchor === null) {
    const opening = snaps[0];
    const kicked =
      target.action === "kickoff" &&
      target.start !== null &&
      target.end !== null
        ? kickedAway(
            target,
            "kickoff",
            target.start,
            target.end,
            offense === "home" ? "away" : "home",
          )
        : null;
    if (!opening && !kicked) return nowhere;
    return {
      field: opening
        ? fieldAt(opening.start, opening)
        : fieldAt(kicked?.to ?? 0, null),
      set: [],
      kick: kicked,
      scoredBy,
    };
  }

  const anchorIndex = snaps.indexOf(anchor);
  const driveSpots: number[] = [];
  for (const snap of snaps.slice(0, anchorIndex + 1)) {
    if (snap.start !== driveSpots.at(-1)) driveSpots.push(snap.start);
  }

  const series = driveSeries(drive).find((candidate) =>
    candidate.plays.includes(anchor),
  );
  const linedUp = !played && anchor.id === playId;
  const setSnaps = (series?.plays ?? [anchor]).filter(isSetSnap);
  const through = setSnaps.filter(
    (snap) =>
      snaps.indexOf(snap) < anchorIndex || (snap === anchor && !linedUp),
  );
  const set = through.map((snap) => {
    const next = snaps[snaps.indexOf(snap) + 1];
    return downStep(snap, next?.start ?? snap.end ?? snap.start, offense);
  });

  const kick: KickFlight | null =
    !isKickedSnap(anchor) || linedUp
      ? null
      : anchor.action === "punt"
        ? kickedAway(
            anchor,
            "punt",
            anchor.start,
            anchor.end ?? anchor.start,
            offense,
          )
        : {
            id: anchor.id,
            action: "fieldGoal",
            from: anchor.start,
            landed: postsFor(offense),
            to: postsFor(offense),
            returned: false,
          };

  return {
    field: { ...fieldAt(anchor.start, anchor), driveSpots },
    set,
    kick,
    scoredBy,
  };
}

/** Every play of the game, oldest first. */
export function playsInOrder(drives: Drive[]): Play[] {
  return drives.flatMap((drive) => drive.plays);
}

/**
 * The drives through a play. Its own drive is cut after it and marked in
 * progress, since its result and summary would spoil what follows. An unknown
 * play returns the drives unchanged.
 */
export function drivesThrough(drives: Drive[], playId: string): Drive[] {
  const through: Drive[] = [];
  for (const drive of drives) {
    const index = drive.plays.findIndex((play) => play.id === playId);
    if (index === -1) {
      through.push(drive);
      continue;
    }
    through.push(
      index === drive.plays.length - 1
        ? drive
        : {
            ...drive,
            description: null,
            result: null,
            isScore: false,
            inProgress: true,
            plays: drive.plays.slice(0, index + 1),
          },
    );
    return through;
  }
  return drives;
}

/** The score once a play was over, from the latest play to carry one. */
export function scoreAfter(
  drives: Drive[],
  playId: string,
): { home: number; away: number } | null {
  const plays = playsInOrder(drives);
  const index = plays.findIndex((play) => play.id === playId);
  for (let at = index; at >= 0; at -= 1) {
    const score = plays[at]?.score;
    if (score) return score;
  }
  return index === -1 ? null : { home: 0, away: 0 };
}

/** Each side's timeouts as a half opens; overtime grants two. */
function timeoutsGranted(period: number): number {
  return period <= 4 ? 3 : 2;
}

/** Which allotment of timeouts a period draws on: a half, or an overtime. */
function timeoutHalf(period: number): number {
  return period <= 2 ? 1 : period <= 4 ? 2 : period;
}

/**
 * Each side's timeouts left in `period` after `throughId`. A null
 * `throughId` means nothing has happened yet.
 */
export function timeoutsLeft(
  drives: Drive[],
  throughId: string | null,
  period: number,
): { home: number; away: number } {
  const left = {
    home: timeoutsGranted(period),
    away: timeoutsGranted(period),
  };
  if (throughId === null) return left;
  for (const play of playsInOrder(drives)) {
    if (
      play.timeoutBy &&
      play.period !== null &&
      timeoutHalf(play.period) === timeoutHalf(period)
    ) {
      left[play.timeoutBy] = Math.max(0, left[play.timeoutBy] - 1);
    }
    if (play.id === throughId) break;
  }
  return left;
}

/** Each side's points per period through `period`, after `throughId`. */
export function pointsByPeriod(
  drives: Drive[],
  throughId: string | null,
  period: number,
): { home: number[]; away: number[] } {
  const points = {
    home: Array.from({ length: period }, () => 0),
    away: Array.from({ length: period }, () => 0),
  };
  if (throughId === null) return points;
  let previous = { home: 0, away: 0 };
  for (const play of playsInOrder(drives)) {
    if (play.score && play.period !== null && play.period <= period) {
      const at = play.period - 1;
      points.home[at] =
        (points.home[at] ?? 0) + play.score.home - previous.home;
      points.away[at] =
        (points.away[at] ?? 0) + play.score.away - previous.away;
    }
    if (play.score) previous = play.score;
    if (play.id === throughId) break;
  }
  return points;
}

/** The score going into a drive and once it was over. */
export interface DriveScore {
  before: { home: number; away: number };
  after: { home: number; away: number };
}

/**
 * Each drive's score before and after it, by drive id, carried forward from
 * the last play to report one.
 */
export function scoreByDrive(drives: Drive[]): Map<string, DriveScore> {
  const scores = new Map<string, DriveScore>();
  let current = { home: 0, away: 0 };
  for (const drive of drives) {
    const before = current;
    for (const play of drive.plays) if (play.score) current = play.score;
    scores.set(drive.id, { before, after: current });
  }
  return scores;
}

/** The drives under one quarter's heading; see `drivesByQuarter`. */
export interface QuarterGroup {
  /** Null only for drives ahead of any play with a period. */
  period: number | null;
  drives: Drive[];
}

/**
 * Drives grouped by quarter, oldest first. Each quarter opens at the first
 * drive with a play in it, so a drive crossing into Q2 opens Q2.
 */
export function drivesByQuarter(drives: Drive[]): QuarterGroup[] {
  const groups: QuarterGroup[] = [];
  let reached = 0;
  for (const drive of drives) {
    const periods = [
      ...new Set(
        drive.plays.flatMap((play) =>
          play.period === null ? [] : [play.period],
        ),
      ),
    ].sort((a, b) => a - b);
    for (const period of periods) {
      if (period > reached) {
        groups.push({ period, drives: [] });
        reached = period;
      }
    }
    const group = groups.at(-1) ?? { period: null, drives: [] };
    if (groups.length === 0) groups.push(group);
    group.drives.push(drive);
  }
  return groups;
}
