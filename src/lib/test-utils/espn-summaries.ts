/**
 * Hand-written ESPN game summaries for tests, with only the fields
 * `extractPlayByPlay` reads. Each play is one scripted line; the builder fills
 * in down-and-distance text, running score and the drive under way.
 */

/** ESPN's play type ids, by the name it gives each. */
const PLAY_TYPES = {
  Kickoff: "53",
  Rush: "5",
  "Pass Reception": "24",
  "Pass Incompletion": "3",
  Sack: "7",
  Penalty: "8",
  Punt: "52",
  "Field Goal Good": "59",
  "Passing Touchdown": "67",
  "Pass Interception Return": "26",
  "Fumble Recovery (Opponent)": "29",
  "Fumble Recovery (Own)": "9",
  "Fumble Return Touchdown": "39",
  Timeout: "21",
  "Official Timeout": "74",
  "End Period": "2",
  "End of Half": "65",
  "End of Game": "66",
} as const;

type PlayType = keyof typeof PLAY_TYPES;
type Side = "home" | "away";

interface ScriptedPlay {
  type: PlayType;
  text: string;
  period: number;
  clock: string;
  /** A snap's down, distance and spot; a kick's spot alone. */
  start?: readonly [down: number, distance: number, yardLine: number] | number;
  /** Where it left the ball; with the next down, as ESPN gives it mid-drive. */
  end?: readonly [down: number, distance: number, yardLine: number] | number;
  /** The score once this play is over, when it changed. */
  score?: readonly [home: number, away: number];
  scoring?: boolean;
  turnover?: boolean;
  /** A flag on the play, with the foul's name when ESPN gives one. */
  penalty?: string | true;
}

interface ScriptedDrive {
  id: string;
  team: Side;
  /** Absent for the drive under way. */
  result?: string;
  description?: string;
  isScore?: boolean;
  plays: ScriptedPlay[];
}

interface Competitor {
  id: string;
  abbreviation: string;
}

interface SummaryScript {
  home: Competitor;
  away: Competitor;
  drives: ScriptedDrive[];
  /** The last drive is still going: ESPN lists it as `current` too. */
  live?: boolean;
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th"];

/** "2nd & 5 at ATL 19", or "Goal" when goal to go. */
function downDistanceText(
  down: number,
  distance: number,
  yardLine: number,
  offense: Side,
  home: Competitor,
  away: Competitor,
): string {
  const toGoal = offense === "home" ? 100 - yardLine : yardLine;
  const togo = toGoal === distance ? "Goal" : String(distance);
  const spot =
    yardLine === 50
      ? "50"
      : yardLine < 50
        ? `${home.abbreviation} ${yardLine}`
        : `${away.abbreviation} ${100 - yardLine}`;
  return `${ORDINALS[down]} & ${togo} at ${spot}`;
}

export function makeSummary({ home, away, drives, live }: SummaryScript) {
  let score: readonly [number, number] = [0, 0];
  let nextId = 1;

  const raw = drives.map((drive) => ({
    id: drive.id,
    description: drive.description ?? null,
    displayResult: drive.result ?? null,
    isScore: drive.isScore ?? false,
    team: { id: drive.team === "home" ? home.id : away.id },
    plays: drive.plays.map((play) => {
      if (play.score) score = play.score;
      const start =
        play.start === undefined
          ? undefined
          : typeof play.start === "number"
            ? { down: 0, distance: 0, yardLine: play.start }
            : {
                down: play.start[0],
                distance: play.start[1],
                yardLine: play.start[2],
                downDistanceText: downDistanceText(
                  ...play.start,
                  drive.team,
                  home,
                  away,
                ),
              };
      const id = String(nextId);
      nextId += 1;
      return {
        id,
        type: { id: PLAY_TYPES[play.type], text: play.type },
        text: play.text,
        homeScore: score[0],
        awayScore: score[1],
        period: { number: play.period },
        clock: { displayValue: play.clock },
        scoringPlay: play.scoring ?? false,
        isTurnover: play.turnover ?? false,
        isPenalty: play.penalty !== undefined,
        ...(typeof play.penalty === "string"
          ? { penalty: { type: { text: play.penalty } } }
          : {}),
        ...(start ? { start } : {}),
        ...(play.end === undefined
          ? {}
          : typeof play.end === "number"
            ? { end: { yardLine: play.end } }
            : {
                end: {
                  down: play.end[0],
                  distance: play.end[1],
                  yardLine: play.end[2],
                  downDistanceText: downDistanceText(
                    ...play.end,
                    drive.team,
                    home,
                    away,
                  ),
                },
              }),
      };
    }),
  }));

  return {
    header: {
      competitions: [
        {
          competitors: [
            {
              id: home.id,
              homeAway: "home",
              team: { abbreviation: home.abbreviation },
            },
            {
              id: away.id,
              homeAway: "away",
              team: { abbreviation: away.abbreviation },
            },
          ],
        },
      ],
    },
    drives: { previous: raw, ...(live ? { current: raw.at(-1) } : {}) },
  };
}

/**
 * A game under way early in the second quarter, BAL at ATL. ESPN's text calls
 * Baltimore by its gamebook code, BLT. Six drives:
 *
 * 1. BAL's opening field goal, after a touchback and a goal-to-go stand.
 * 2. ATL's three-and-out, after a returned kickoff called back for holding.
 * 3. BAL's sack and the fumble ATL returns for a touchdown.
 * 4. BAL's punt.
 * 5. ATL's punt, fair caught.
 * 6. BAL's drive under way, across the end of the first quarter, through a
 *    neutral zone infraction and a delay of game.
 */
export const SHORT_GAME = makeSummary({
  home: { id: "1", abbreviation: "ATL" },
  away: { id: "33", abbreviation: "BAL" },
  live: true,
  drives: [
    {
      id: "d1",
      team: "away",
      result: "Field Goal",
      description: "10 plays, 62 yards, 4:33",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 1,
          clock: "15:00",
          start: 35,
          end: 65,
          text: "K.Archer kicks 65 yards from ATL 35 to end zone, Touchback to the BLT 35.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "15:00",
          start: [1, 10, 65],
          end: 52,
          text: "R.Swift right end to BLT 48 for 13 yards (X.Stop).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "14:23",
          start: [1, 10, 52],
          end: 45,
          text: "(Shotgun) D.Ram right guard to ATL 45 for 7 yards (K.Wall).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "13:48",
          start: [2, 3, 45],
          end: 45,
          text: "(Shotgun) T.Hand pass incomplete short right to J.Dash.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "13:44",
          start: [3, 3, 45],
          end: 24,
          text: "(Shotgun) J.Dash left tackle to ATL 24 for 21 yards (M.Reed).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "13:02",
          start: [1, 10, 24],
          end: 19,
          text: "D.Ram left tackle to ATL 19 for 5 yards (K.Wall).",
        },
        {
          type: "Pass Reception",
          period: 1,
          clock: "12:23",
          start: [2, 5, 19],
          end: 8,
          text: "T.Hand pass short right to R.Swift to ATL 8 for 11 yards (X.Stop).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "11:39",
          start: [1, 8, 8],
          end: 1,
          text: "D.Ram left end to ATL 1 for 7 yards (M.Reed).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "10:57",
          start: [2, 1, 1],
          end: 3,
          text: "(10:57) (Shotgun) Direct snap to D.Ram.  D.Ram up the middle to ATL 3 for -2 yards (G.Line, L.Hold).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "10:36",
          start: [3, 3, 3],
          end: 3,
          text: "(Shotgun) T.Hand pass incomplete short right to M.Tight.",
        },
        {
          type: "Field Goal Good",
          period: 1,
          clock: "10:27",
          start: [4, 3, 3],
          end: 0,
          score: [0, 3],
          scoring: true,
          text: "P.Boot 21 yard field goal is GOOD, Center-N.Snap, Holder-R.Hang.",
        },
        {
          type: "Official Timeout",
          period: 1,
          clock: "10:27",
          text: "Official Timeout at 10:27.",
        },
      ],
    },
    {
      id: "d2",
      team: "home",
      result: "Punt",
      description: "3 plays, 4 yards, 0:54",
      plays: [
        {
          type: "Kickoff",
          period: 1,
          clock: "10:27",
          start: 65,
          end: 17,
          penalty: true,
          text: "P.Boot kicks 58 yards from BLT 35 to ATL 7. O.Return to ATL 32 for 25 yards (M.Cover). PENALTY on ATL-J.Block, Offensive Holding, 10 yards, enforced at ATL 27.",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "10:21",
          start: [1, 10, 17],
          end: 17,
          text: "M.Sling pass incomplete deep middle to D.Reach.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "10:15",
          start: [2, 10, 17],
          end: 21,
          text: "(Shotgun) B.Burst left guard to ATL 21 for 4 yards (T.Rush).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "9:46",
          start: [3, 6, 21],
          end: 21,
          text: "(Shotgun) M.Sling pass incomplete short right to B.Burst (T.Rush).",
        },
        {
          type: "Punt",
          period: 1,
          clock: "9:41",
          start: [4, 6, 21],
          end: 77,
          text: "K.Archer punts 56 yards to BLT 23, Center-L.Long, fair catch by L.Catch.",
        },
        {
          type: "Official Timeout",
          period: 1,
          clock: "9:33",
          text: "Official Timeout at 09:33.",
        },
      ],
    },
    {
      id: "d3",
      team: "away",
      result: "Fumble Return Touchdown",
      description: "3 plays, 11 yards, 1:30",
      isScore: true,
      plays: [
        {
          type: "Rush",
          period: 1,
          clock: "9:33",
          start: [1, 10, 77],
          end: 66,
          text: "D.Ram right tackle to BLT 34 for 11 yards (X.Stop).",
        },
        {
          type: "Sack",
          period: 1,
          clock: "8:59",
          start: [1, 10, 66],
          end: 75,
          text: "(Shotgun) T.Hand sacked at BLT 25 for -9 yards (J.Edge).",
        },
        {
          type: "Fumble Return Touchdown",
          period: 1,
          clock: "8:03",
          start: [2, 19, 75],
          end: 100,
          score: [7, 3],
          scoring: true,
          turnover: true,
          text: "(Shotgun) T.Hand pass short middle to M.Tight to BLT 34 for 9 yards (D.Back). FUMBLES (D.Back), RECOVERED by ATL-J.Scoop at BLT 36. J.Scoop for 36 yards, TOUCHDOWN. K.Archer extra point is GOOD.",
        },
        {
          type: "Official Timeout",
          period: 1,
          clock: "8:03",
          text: "Official Timeout at 08:03.",
        },
      ],
    },
    {
      id: "d4",
      team: "away",
      result: "Punt",
      description: "6 plays, 16 yards, 3:16",
      plays: [
        {
          type: "Kickoff",
          period: 1,
          clock: "8:03",
          start: 35,
          end: 65,
          text: "K.Archer kicks 65 yards from ATL 35 to end zone, Touchback to the BLT 35.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "8:03",
          start: [1, 10, 65],
          end: 56,
          text: "D.Ram up the middle to BLT 44 for 9 yards (D.Back).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "7:30",
          start: [2, 1, 56],
          end: 56,
          text: "(Shotgun) D.Ram right tackle to BLT 44 for no gain (L.Hold).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "6:54",
          start: [3, 1, 56],
          end: 54,
          text: "T.Hand up the middle to BLT 46 for 2 yards (L.Hold).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "6:15",
          start: [1, 10, 54],
          end: 54,
          text: "T.Hand pass incomplete short middle to D.Ram (K.Wall).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "6:10",
          start: [2, 10, 54],
          end: 49,
          text: "J.Dash right end to ATL 49 for 5 yards (D.Back).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "5:30",
          start: [3, 5, 49],
          end: 49,
          text: "(Shotgun) J.Dash right guard to ATL 49 for no gain (B.Tackle).",
        },
        {
          type: "Punt",
          period: 1,
          clock: "4:53",
          start: [4, 5, 49],
          end: 12,
          text: "R.Hang punts 37 yards to ATL 12, Center-N.Snap, fair catch by O.Return.",
        },
      ],
    },
    {
      id: "d5",
      team: "home",
      result: "Punt",
      description: "4 plays, 28 yards, 2:16",
      plays: [
        {
          type: "Rush",
          period: 1,
          clock: "4:47",
          start: [1, 10, 12],
          end: 32,
          text: "B.Burst left guard to ATL 32 for 20 yards (R.Safe).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "4:07",
          start: [1, 10, 32],
          end: 35,
          text: "B.Burst left guard to ATL 35 for 3 yards (Z.Mike).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "3:28",
          start: [2, 7, 35],
          end: 35,
          text: "M.Sling pass incomplete short left to D.Reach.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "3:24",
          start: [3, 7, 35],
          end: 40,
          text: "(Shotgun) M.Sling scrambles right end to ATL 40 for 5 yards (K.End).",
        },
        {
          type: "Punt",
          period: 1,
          clock: "2:39",
          start: [4, 2, 40],
          end: 86,
          text: "K.Archer punts 46 yards to BLT 14, Center-L.Long, fair catch by L.Catch.",
        },
      ],
    },
    {
      id: "d6",
      team: "away",
      description: "8 plays, 26 yards, 5:01",
      plays: [
        {
          type: "Pass Reception",
          period: 1,
          clock: "2:31",
          start: [1, 10, 86],
          end: 80,
          text: "(Shotgun) T.Hand pass short right to R.Swift to BLT 20 for 6 yards (D.Back).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "1:52",
          start: [2, 4, 80],
          end: 77,
          text: "(Shotgun) D.Ram right guard to BLT 23 for 3 yards (L.Hold).",
        },
        {
          type: "Pass Reception",
          period: 1,
          clock: "1:20",
          start: [3, 1, 77],
          end: 75,
          text: "(Shotgun) T.Hand pass short right to D.Wing to BLT 25 for 2 yards (K.Wall).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "0:36",
          start: [1, 10, 75],
          end: 66,
          text: "D.Ram up the middle to BLT 34 for 9 yards (X.Stop).",
        },
        { type: "End Period", period: 1, clock: "0:00", text: "END QUARTER 1" },
        {
          type: "Rush",
          period: 2,
          clock: "15:00",
          start: [2, 1, 66],
          end: 62,
          text: "D.Ram right guard to BLT 38 for 4 yards (K.Wall).",
        },
        {
          type: "Penalty",
          period: 2,
          clock: "14:20",
          start: [1, 10, 62],
          end: 57,
          penalty: true,
          text: "PENALTY on ATL-M.Jump, Neutral Zone Infraction, 5 yards, enforced at BLT 38 - No Play.",
        },
        {
          type: "Sack",
          period: 2,
          clock: "13:59",
          start: [1, 5, 57],
          end: 57,
          text: "T.Hand sacked at BLT 43 for 0 yards (K.Wall).",
        },
        {
          type: "Rush",
          period: 2,
          clock: "13:17",
          start: [2, 5, 57],
          end: 55,
          text: "D.Ram left tackle to BLT 45 for 2 yards (D.Back).",
        },
        {
          type: "Pass Incompletion",
          period: 2,
          clock: "12:33",
          start: [3, 3, 55],
          end: 55,
          text: "(Shotgun) T.Hand pass incomplete short middle to R.Swift.",
        },
        {
          type: "Penalty",
          period: 2,
          clock: "12:30",
          start: [4, 3, 55],
          end: 60,
          penalty: true,
          text: " (Punt formation) PENALTY on BLT, Delay of Game, 5 yards, enforced at BLT 45 - No Play.",
        },
      ],
    },
  ],
});

/**
 * A whole game, MIN at NO, 23–13, covering every headline, every drive
 * result, a run and a pass whose type names neither, timeouts in both halves,
 * and a score in every quarter.
 */
export const FULL_GAME = makeSummary({
  home: { id: "18", abbreviation: "NO" },
  away: { id: "16", abbreviation: "MIN" },
  drives: [
    {
      id: "f1",
      team: "away",
      result: "Field Goal",
      description: "8 plays, 49 yards, 4:10",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 1,
          clock: "15:00",
          start: 35,
          end: 72,
          text: "K.Foot kicks 64 yards from NO 35 to MIN 1. C.Return to MIN 28 for 27 yards (S.Cover).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "14:55",
          start: [1, 10, 72],
          end: 66,
          text: "B.Back right guard to MIN 34 for 6 yards (L.Mike).",
        },
        {
          type: "Pass Reception",
          period: 1,
          clock: "14:20",
          start: [2, 4, 66],
          end: 59,
          text: "Q.Arm pass short middle to T.End to MIN 41 for 7 yards (S.Safe).",
        },
        {
          type: "Penalty",
          period: 1,
          clock: "13:45",
          start: [1, 10, 59],
          end: 64,
          penalty: "False Start",
          text: "PENALTY on MIN-O.Line, False Start, 5 yards, enforced at MIN 41 - No Play.",
        },
        {
          type: "Pass Reception",
          period: 1,
          clock: "13:45",
          start: [1, 15, 64],
          end: 21,
          text: "(Shotgun) Q.Arm pass deep right to W.Wide to NO 21 for 43 yards (S.Safe).",
        },
        {
          type: "Rush",
          period: 1,
          clock: "13:00",
          start: [1, 10, 21],
          end: 21,
          text: "B.Back up the middle to NO 21 for no gain (L.Mike).",
        },
        {
          type: "Pass Incompletion",
          period: 1,
          clock: "12:20",
          start: [2, 10, 21],
          end: 21,
          text: "(Shotgun) Q.Arm pass incomplete deep left to W.Wide.",
        },
        {
          type: "Rush",
          period: 1,
          clock: "12:15",
          start: [3, 10, 21],
          end: 23,
          text: "B.Back up the middle to NO 23 for -2 yards (D.Tackle).",
        },
        {
          type: "Field Goal Good",
          period: 1,
          clock: "10:50",
          start: [4, 12, 23],
          end: 0,
          score: [0, 3],
          scoring: true,
          text: "K.Leg 40 yard field goal is GOOD, Center-L.Snap, Holder-P.Hang.",
        },
      ],
    },
    {
      id: "f2",
      team: "home",
      result: "Interception",
      description: "5 plays, 7 yards, 2:30",
      plays: [
        {
          type: "Kickoff",
          period: 1,
          clock: "10:50",
          start: 65,
          end: 35,
          text: "K.Leg kicks 65 yards from MIN 35 to end zone, Touchback to the NO 35.",
        },
        {
          type: "Pass Reception",
          period: 1,
          clock: "10:50",
          start: [1, 10, 35],
          end: 47,
          text: "N.Arm pass short right to N.Wide to NO 47 for 12 yards (M.Corner).",
        },
        {
          type: "Penalty",
          period: 1,
          clock: "10:10",
          start: [1, 10, 47],
          end: 37,
          penalty: true,
          text: "N.Runner up the middle to MIN 40 for 13 yards (M.Lb). PENALTY on NO-N.Guard, Offensive Holding, 10 yards, enforced at NO 47 - No Play.",
        },
        {
          type: "Penalty",
          period: 1,
          clock: "9:40",
          start: [1, 20, 37],
          end: 42,
          penalty: true,
          text: "(Shotgun) N.Arm pass incomplete short right.PENALTY on MIN-M.Corner, Defensive Holding, 5 yards, enforced at NO 37 - No Play.",
        },
        {
          type: "Sack",
          period: 1,
          clock: "9:30",
          start: [1, 10, 42],
          end: 32,
          text: "(Shotgun) N.Arm sacked at NO 32 for -10 yards (M.Edge).",
        },
        {
          type: "Pass Interception Return",
          period: 1,
          clock: "8:20",
          start: [2, 20, 32],
          end: 40,
          turnover: true,
          text: "(Shotgun) N.Arm pass short left intended for N.Wide INTERCEPTED by M.Corner at NO 45. M.Corner to NO 40 for 5 yards (N.Wide).",
        },
      ],
    },
    {
      id: "f3",
      team: "away",
      result: "Fumble",
      description: "3 plays, 15 yards, 1:40",
      plays: [
        {
          type: "Rush",
          period: 1,
          clock: "1:10",
          start: [1, 10, 40],
          end: 36,
          text: "B.Back left end to NO 36 for 4 yards (L.Mike).",
        },
        { type: "End Period", period: 1, clock: "0:00", text: "END QUARTER 1" },
        {
          type: "Pass Reception",
          period: 2,
          clock: "15:00",
          start: [2, 6, 36],
          end: 30,
          text: "Q.Arm pass short right to W.Wide to NO 30 for 6 yards (S.Cover).",
        },
        {
          type: "Fumble Recovery (Opponent)",
          period: 2,
          clock: "14:20",
          start: [1, 10, 30],
          end: 25,
          turnover: true,
          text: "Q.Arm pass short middle to T.End to NO 25 for 5 yards (S.Safe). FUMBLES (S.Safe), RECOVERED by NO-L.Mike at NO 25.",
        },
      ],
    },
    {
      id: "f4",
      team: "home",
      result: "Touchdown",
      description: "3 plays, 75 yards, 1:50",
      isScore: true,
      plays: [
        {
          type: "Pass Reception",
          period: 2,
          clock: "14:15",
          start: [1, 10, 25],
          end: 70,
          text: "N.Arm pass deep left to N.Wide to MIN 30 for 45 yards (M.Corner).",
        },
        {
          type: "Rush",
          period: 2,
          clock: "13:35",
          start: [1, 10, 70],
          end: 82,
          text: "N.Runner up the middle to MIN 18 for 12 yards (M.Lb).",
        },
        {
          type: "Passing Touchdown",
          period: 2,
          clock: "12:25",
          start: [1, 10, 82],
          end: 100,
          score: [7, 3],
          scoring: true,
          text: "N.Arm pass short left to N.Tight for 18 yards, TOUCHDOWN. K.Foot extra point is GOOD.",
        },
      ],
    },
    {
      id: "f5",
      team: "away",
      result: "Field Goal",
      description: "5 plays, 35 yards, 1:20",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 2,
          clock: "12:25",
          start: 35,
          end: 65,
          text: "K.Foot kicks 65 yards from NO 35 to end zone, Touchback to the MIN 35.",
        },
        {
          type: "Timeout",
          period: 2,
          clock: "1:30",
          text: "Timeout #1 by MIN at 01:30.",
        },
        {
          type: "Pass Reception",
          period: 2,
          clock: "1:30",
          start: [1, 10, 65],
          end: 45,
          text: "(Shotgun) Q.Arm pass short left to W.Wide to NO 45 for 20 yards (S.Cover).",
        },
        {
          type: "Timeout",
          period: 2,
          clock: "0:50",
          text: "Timeout #2 by MIN at 00:50.",
        },
        {
          type: "Pass Reception",
          period: 2,
          clock: "0:50",
          start: [1, 10, 45],
          end: 30,
          text: "(Shotgun) Q.Arm pass short middle to T.End to NO 30 for 15 yards (S.Safe).",
        },
        {
          type: "Pass Incompletion",
          period: 2,
          clock: "0:31",
          start: [1, 10, 30],
          end: 30,
          text: "Q.Arm spiked the ball to stop the clock.",
        },
        {
          type: "Pass Incompletion",
          period: 2,
          clock: "0:30",
          start: [2, 10, 30],
          end: 30,
          text: "(Shotgun) Q.Arm pass incomplete deep right to W.Wide.",
        },
        {
          type: "Timeout",
          period: 2,
          clock: "0:26",
          text: "Timeout #3 by MIN at 00:26.",
        },
        {
          type: "Field Goal Good",
          period: 2,
          clock: "0:22",
          start: [3, 10, 30],
          end: 0,
          score: [7, 6],
          scoring: true,
          text: "K.Leg 47 yard field goal is GOOD, Center-L.Snap, Holder-P.Hang.",
        },
        {
          type: "End of Half",
          period: 2,
          clock: "0:00",
          text: "END QUARTER 2",
        },
      ],
    },
    {
      id: "f6",
      team: "home",
      result: "Field Goal",
      description: "6 plays, 28 yards, 4:00",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 3,
          clock: "15:00",
          start: 65,
          end: 35,
          text: "K.Leg kicks 65 yards from MIN 35 to end zone, Touchback to the NO 35.",
        },
        {
          type: "Rush",
          period: 3,
          clock: "15:00",
          start: [1, 10, 35],
          end: 40,
          text: "N.Runner up the middle to NO 40 for 5 yards (M.Lb).",
        },
        {
          type: "Pass Reception",
          period: 3,
          clock: "14:20",
          start: [2, 5, 40],
          end: 60,
          text: "N.Arm pass short right to N.Wide to MIN 40 for 20 yards (M.Corner).",
        },
        {
          type: "Pass Incompletion",
          period: 3,
          clock: "13:40",
          start: [1, 10, 60],
          end: 60,
          text: "N.Arm pass incomplete short left to N.Tight.",
        },
        {
          type: "Rush",
          period: 3,
          clock: "13:35",
          start: [2, 10, 60],
          end: 63,
          text: "N.Runner left tackle to MIN 37 for 3 yards (M.Lb).",
        },
        {
          type: "Pass Incompletion",
          period: 3,
          clock: "12:55",
          start: [3, 7, 63],
          end: 63,
          text: "(Shotgun) N.Arm pass incomplete deep right to N.Wide.",
        },
        {
          type: "Field Goal Good",
          period: 3,
          clock: "11:00",
          start: [4, 7, 63],
          end: 100,
          score: [10, 6],
          scoring: true,
          text: "K.Foot 54 yard field goal is GOOD, Center-N.Snap, Holder-P.Drop.",
        },
      ],
    },
    {
      id: "f7",
      team: "away",
      result: "Touchdown",
      description: "4 plays, 65 yards, 2:10",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 3,
          clock: "11:00",
          start: 35,
          end: 65,
          text: "K.Foot kicks 65 yards from NO 35 to end zone, Touchback to the MIN 35.",
        },
        {
          type: "Rush",
          period: 3,
          clock: "11:00",
          start: [1, 10, 65],
          end: 60,
          text: "B.Back right tackle to MIN 40 for 5 yards (L.Mike).",
        },
        {
          type: "Penalty",
          period: 3,
          clock: "10:25",
          start: [2, 5, 60],
          end: 28,
          penalty: true,
          text: "(Shotgun) Q.Arm scrambles left end ran ob at NO 43 for 17 yards (S.Cover). PENALTY on NO-S.Cover, Unnecessary Roughness, 15 yards, enforced at NO 43.",
        },
        {
          type: "Fumble Recovery (Own)",
          period: 3,
          clock: "9:50",
          start: [1, 10, 28],
          end: 36,
          text: "W.Wide to NO 36 for -8 yards (S.Safe). FUMBLES (S.Safe), recovered by MIN-W.Wide at NO 36.",
        },
        {
          type: "Passing Touchdown",
          period: 3,
          clock: "8:50",
          start: [2, 18, 36],
          end: 0,
          score: [10, 13],
          scoring: true,
          text: "(Shotgun) Q.Arm pass short right to T.End for 36 yards, TOUCHDOWN. K.Leg extra point is GOOD.",
        },
      ],
    },
    {
      id: "f8",
      team: "home",
      result: "Field Goal",
      description: "9 plays, 45 yards, 6:30",
      isScore: true,
      plays: [
        {
          type: "Kickoff",
          period: 3,
          clock: "8:50",
          start: 65,
          end: 35,
          text: "K.Leg kicks 65 yards from MIN 35 to end zone, Touchback to the NO 35.",
        },
        {
          type: "Timeout",
          period: 3,
          clock: "4:08",
          text: "Timeout #1 by NO at 04:08.",
        },
        {
          type: "Rush",
          period: 3,
          clock: "4:08",
          start: [1, 10, 35],
          end: 38,
          text: "N.Runner right guard to NO 38 for 3 yards (M.Lb).",
        },
        {
          type: "Timeout",
          period: 3,
          clock: "3:42",
          text: "Timeout #1 by MIN at 03:42.",
        },
        {
          type: "Pass Incompletion",
          period: 3,
          clock: "3:42",
          start: [2, 7, 38],
          end: 38,
          text: "N.Arm pass incomplete short middle to N.Tight.",
        },
        {
          type: "Pass Reception",
          period: 3,
          clock: "3:38",
          start: [3, 7, 38],
          end: 51,
          text: "(Shotgun) N.Arm pass short right to N.Wide to MIN 49 for 13 yards (M.Corner).",
        },
        {
          type: "Pass Reception",
          period: 3,
          clock: "3:00",
          start: [1, 10, 51],
          end: 80,
          text: "N.Arm pass deep middle to N.Tight to MIN 20 for 29 yards (S.Safe).",
        },
        {
          type: "Rush",
          period: 3,
          clock: "2:20",
          start: [1, 10, 80],
          end: 80,
          text: "N.Runner up the middle to MIN 20 for no gain (M.Lb).",
        },
        {
          type: "Pass Incompletion",
          period: 3,
          clock: "1:40",
          start: [2, 10, 80],
          end: 80,
          text: "N.Arm pass incomplete short right to N.Wide.",
        },
        {
          type: "Pass Incompletion",
          period: 3,
          clock: "1:35",
          start: [3, 10, 80],
          end: 80,
          text: "(Shotgun) N.Arm pass incomplete deep left to N.Wide.",
        },
        {
          type: "Field Goal Good",
          period: 3,
          clock: "1:30",
          start: [4, 10, 80],
          end: 100,
          score: [13, 13],
          scoring: true,
          text: "K.Foot 37 yard field goal is GOOD, Center-N.Snap, Holder-P.Drop.",
        },
      ],
    },
    {
      id: "f9",
      team: "away",
      result: "Punt",
      description: "4 plays, 2 yards, 2:10",
      plays: [
        {
          type: "Kickoff",
          period: 3,
          clock: "1:30",
          start: 35,
          end: 65,
          text: "K.Foot kicks 65 yards from NO 35 to end zone, Touchback to the MIN 35.",
        },
        {
          type: "Rush",
          period: 3,
          clock: "1:30",
          start: [1, 10, 65],
          end: 63,
          text: "B.Back left guard to MIN 37 for 2 yards (L.Mike).",
        },
        { type: "End Period", period: 3, clock: "0:00", text: "END QUARTER 3" },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "15:00",
          start: [2, 8, 63],
          end: 63,
          text: "Q.Arm pass incomplete short left to W.Wide.",
        },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "14:55",
          start: [3, 8, 63],
          end: 63,
          text: "(Shotgun) Q.Arm pass incomplete deep middle to T.End.",
        },
        {
          type: "Punt",
          period: 4,
          clock: "14:50",
          start: [4, 8, 63],
          end: 7,
          text: "P.Hang punts 56 yards to NO 7, Center-L.Snap, fair catch by N.Return.",
        },
      ],
    },
    {
      id: "f10",
      team: "home",
      result: "Fumble Return Touchdown",
      description: "1 play, 8 yards, 0:20",
      isScore: true,
      plays: [
        {
          type: "Fumble Return Touchdown",
          period: 4,
          clock: "14:40",
          start: [1, 10, 7],
          end: 0,
          score: [13, 20],
          scoring: true,
          turnover: true,
          text: "N.Arm pass short middle to N.Tight to NO 15 for 8 yards (M.Lb). FUMBLES (M.Lb), RECOVERED by MIN-S.Sweep at NO 15. S.Sweep for 15 yards, TOUCHDOWN. K.Leg extra point is GOOD.",
        },
      ],
    },
    {
      id: "f11",
      team: "home",
      result: "Downs",
      description: "4 plays, 4 yards, 1:40",
      plays: [
        {
          type: "Kickoff",
          period: 4,
          clock: "14:20",
          start: 65,
          end: 35,
          text: "K.Leg kicks 65 yards from MIN 35 to end zone, Touchback to the NO 35.",
        },
        {
          type: "Timeout",
          period: 4,
          clock: "9:00",
          text: "Timeout #2 by NO at 09:00.",
        },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "9:00",
          start: [1, 10, 35],
          end: 35,
          text: "N.Arm pass incomplete short right to N.Wide.",
        },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "8:55",
          start: [2, 10, 35],
          end: 35,
          text: "N.Arm pass incomplete deep right to N.Tight.",
        },
        {
          type: "Rush",
          period: 4,
          clock: "8:50",
          start: [3, 10, 35],
          end: 39,
          text: "N.Runner left end to NO 39 for 4 yards (M.Lb).",
        },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "8:10",
          start: [4, 6, 39],
          end: 39,
          text: "(Shotgun) N.Arm pass incomplete short middle to N.Wide.",
        },
      ],
    },
    {
      id: "f12",
      team: "away",
      result: "Field Goal",
      description: "4 plays, 14 yards, 6:00",
      isScore: true,
      plays: [
        {
          type: "Rush",
          period: 4,
          clock: "8:05",
          start: [1, 10, 39],
          end: 36,
          text: "B.Back right end to NO 36 for 3 yards (L.Mike).",
        },
        {
          type: "Timeout",
          period: 4,
          clock: "2:45",
          text: "Timeout #3 by NO at 02:45.",
        },
        {
          type: "Rush",
          period: 4,
          clock: "2:45",
          start: [2, 7, 36],
          end: 31,
          text: "B.Back up the middle to NO 31 for 5 yards (D.Tackle).",
        },
        {
          type: "Rush",
          period: 4,
          clock: "2:05",
          start: [3, 2, 31],
          end: 25,
          text: "B.Back left tackle to NO 25 for 6 yards (L.Mike).",
        },
        {
          type: "Field Goal Good",
          period: 4,
          clock: "2:00",
          start: [1, 10, 25],
          end: 0,
          score: [13, 23],
          scoring: true,
          text: "K.Leg 42 yard field goal is GOOD, Center-L.Snap, Holder-P.Hang.",
        },
      ],
    },
    {
      id: "f13",
      team: "home",
      result: "End of Game",
      description: "2 plays, 0 yards, 2:00",
      plays: [
        {
          type: "Kickoff",
          period: 4,
          clock: "2:00",
          start: 65,
          end: 35,
          text: "K.Leg kicks 65 yards from MIN 35 to end zone, Touchback to the NO 35.",
        },
        {
          type: "Pass Incompletion",
          period: 4,
          clock: "2:00",
          start: [1, 10, 35],
          end: 35,
          text: "N.Arm pass incomplete deep right to N.Wide.",
        },
        { type: "End of Game", period: 4, clock: "0:00", text: "END GAME" },
      ],
    },
  ],
});
