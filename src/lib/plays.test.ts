import { describe, expect, it } from "vitest";
import {
  currentSet,
  driveSeries,
  drivesByQuarter,
  drivesThrough,
  extractPlayByPlay,
  fieldAfterPlay,
  fieldAtPlay,
  scoreAfter,
  playsInOrder,
  pointsByPeriod,
  scoreByDrive,
  situationAfterPlay,
  timeoutsLeft,
  withDriveSpots,
} from "~/lib/plays";
import { type Play } from "~/lib/plays.schema";
import { type FieldState } from "~/lib/score.schema";
import {
  FULL_GAME,
  SHORT_GAME,
  makeSummary,
} from "~/lib/test-utils/espn-summaries";

/** BAL (33) at ATL (1), early in the second quarter. */
const drives = extractPlayByPlay(SHORT_GAME);

describe("extractPlayByPlay", () => {
  it("lists each drive once, oldest first, the one under way last", () => {
    expect(drives.map((drive) => drive.id)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
    ]);
    expect(drives.map((drive) => drive.inProgress)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("orients each drive to home and away", () => {
    expect(drives.map((drive) => drive.offense)).toEqual([
      "away",
      "home",
      "away",
      "away",
      "home",
      "away",
    ]);
  });

  it("reads a finished drive's result", () => {
    const [opening] = drives;
    expect(opening).toMatchObject({
      description: "10 plays, 62 yards, 4:33",
      result: "Field Goal",
      isScore: true,
    });
  });

  it("drops official timeouts and keeps the end of a period", () => {
    const texts = drives.flatMap((drive) => drive.plays.map((p) => p.text));
    expect(texts.some((text) => /Official Timeout/.test(text))).toBe(false);
    const endOfQuarter = drives
      .flatMap((drive) => drive.plays)
      .find((play) => play.text === "END QUARTER 1");
    expect(endOfQuarter).toMatchObject({ kind: "stoppage", start: null });
  });

  it("tells a kickoff from a snap", () => {
    const [kickoff, firstSnap] = drives[0]!.plays;
    expect(kickoff).toMatchObject({ kind: "kick", downDistance: null });
    expect(firstSnap).toMatchObject({
      kind: "snap",
      downDistance: "1st & 10 at BAL 35",
      start: 65,
    });
  });

  it("drops the formation note from play text", () => {
    const texts = drives.flatMap((drive) => drive.plays.map((p) => p.text));
    expect(texts.some((text) => text.startsWith("(Shotgun)"))).toBe(false);
  });

  it("flags scores and turnovers with the score after the play", () => {
    const fumble = drives[2]!.plays.find((play) => play.turnover);
    expect(fumble).toMatchObject({
      scoring: true,
      score: { home: 7, away: 3 },
    });
  });

  it("reads a malformed payload as no drives", () => {
    expect(extractPlayByPlay({ drives: "nope" })).toEqual([]);
    expect(extractPlayByPlay(null)).toEqual([]);
  });
});

describe("play actions and outcomes", () => {
  // MIN at NO: every drive and play of a finished game.
  const game = extractPlayByPlay(FULL_GAME);
  const plays = game.flatMap((drive) => drive.plays);
  const byText = (pattern: RegExp) => {
    const found = plays.find((play) => pattern.test(play.text));
    if (!found) throw new Error(`No play ${pattern}`);
    return found;
  };

  it("says what every play tried, but for penalties before the snap", () => {
    const untold = plays.filter(
      (play) => play.kind !== "stoppage" && play.action === null,
    );
    expect(untold.length).toBeGreaterThan(0);
    for (const play of untold) expect(play.text).toMatch(/^PENALTY.*No Play/);
  });

  it("tells a run from a pass even when the type names neither", () => {
    expect(byText(/sacked at NO 32/).action).toBe("pass");
    // Typed "Penalty" and "Fumble Recovery (Own)".
    expect(byText(/scrambles left end ran ob at NO 43/).action).toBe("run");
    expect(byText(/pass incomplete short right\.PENALTY/).action).toBe("pass");
    expect(byText(/^W\.Wide to NO 36 for -8 yards/).action).toBe("run");
  });

  it("tells each drive's end by one of its plays", () => {
    const told: Record<string, Play["outcome"]> = {
      "Field Goal": "fieldGoal",
      Punt: "punt",
      Touchdown: "touchdown",
      "Fumble Return Touchdown": "touchdown",
      Fumble: "fumble",
      Interception: "interception",
      Downs: null,
      "End of Game": null,
    };
    for (const drive of game) {
      const outcomes = drive.plays.flatMap((play) =>
        play.outcome ? [play.outcome] : [],
      );
      const expected = told[drive.result ?? ""];
      expect(outcomes).toEqual(expected ? [expected] : []);
    }
  });

  it("heads every play with its own words, never ESPN's type alone", () => {
    const types = new Set<string>(
      [FULL_GAME, SHORT_GAME].flatMap((summary) =>
        summary.drives.previous.flatMap((drive) =>
          drive.plays.map((play) => play.type.text),
        ),
      ),
    );
    for (const play of [...plays, ...drives.flatMap((drive) => drive.plays)]) {
      if (play.kind === "stoppage") continue;
      expect(types.has(play.headline), play.text).toBe(false);
    }
  });

  it("heads a play the way ESPN's feed does: its kind and how far", () => {
    const headline = (pattern: RegExp) => byText(pattern).headline;
    expect(headline(/^END QUARTER 1$/)).toBe("End of 1st Quarter");
    expect(headline(/^END GAME$/)).toBe("End of game");
    expect(headline(/^Timeout #1 by MIN at 01:30/)).toBe(
      "Timeout #1 by MIN at 01:30",
    );
    expect(headline(/^B\.Back right guard to MIN 34/)).toBe("6-yd Run");
    expect(headline(/pass short middle to T\.End to MIN 41/)).toBe("7-yd Pass");
    expect(headline(/pass incomplete deep left to W\.Wide/)).toBe(
      "Incompletion",
    );
    expect(headline(/sacked at NO 32/)).toBe("10-yd Sack");
    expect(headline(/intended for N\.Wide INTERCEPTED/)).toBe("Interception");
    expect(headline(/^B\.Back up the middle to NO 21 for no gain/)).toBe(
      "Run, No Gain",
    );
    expect(headline(/^B\.Back up the middle to NO 23 for -2/)).toBe(
      "Run, 2-yd Loss",
    );
    expect(headline(/False Start, 5 yards, enforced at MIN 41/)).toBe(
      "False Start",
    );
    expect(headline(/punts 56 yards to NO 7/)).toBe("56-yd Punt");
    expect(headline(/kicks 64 yards from NO 35/)).toBe("64-yd Kickoff");
    expect(headline(/40 yard field goal is GOOD/)).toBe("40-yd Field Goal");
    expect(headline(/spiked the ball/)).toBe("Spike");
  });

  it("tells a run wiped out by a penalty as the run it was", () => {
    // 13 yards up the middle, called back for holding; tagged a penalty.
    const run = byText(/^N\.Runner up the middle to MIN 40/);
    expect(run).toMatchObject({ headline: "13-yd Run", penalty: true });
  });

  it("keeps where a kickoff was kicked from and where it ended", () => {
    expect(game[0]!.plays[0]).toMatchObject({
      action: "kickoff",
      // NO, at home, kicks from its own 35 to the MIN 28.
      start: 35,
      end: 72,
    });
  });
});

describe("withDriveSpots", () => {
  const field: FieldState = {
    offense: "away",
    ballOn: 55,
    lineToGain: 52,
    driveSpots: [86, 55],
  };

  it("fills in every snap of the drive under way", () => {
    expect(withDriveSpots(field, drives).driveSpots).toEqual([
      86, 80, 77, 75, 66, 62, 57, 55,
    ]);
  });

  it("ends at the scoreboard's ball when play-by-play lags it", () => {
    expect(withDriveSpots({ ...field, ballOn: 50 }, drives).driveSpots).toEqual(
      [86, 80, 77, 75, 66, 62, 57, 55, 50],
    );
  });

  it("leaves the field alone once the ball has changed hands", () => {
    const flipped: FieldState = { ...field, offense: "home", ballOn: 20 };
    expect(withDriveSpots(flipped, drives)).toBe(flipped);
  });

  it("leaves the field alone when the last drive is over", () => {
    expect(withDriveSpots(field, drives.slice(0, -1))).toBe(field);
  });
});

describe("currentSet", () => {
  // BAL backed up by a delay of game on 4th & 3 at BAL 45: 4th & 8 at BAL 40.
  const field: FieldState = {
    offense: "away",
    ballOn: 60,
    lineToGain: 52,
    driveSpots: [86, 60],
  };

  it("runs each snap of the set from its spot to the next", () => {
    expect(
      currentSet(field, drives).map(({ from, to, yards, penalty }) => [
        from,
        to,
        yards,
        penalty,
      ]),
    ).toEqual([
      [62, 57, 5, true],
      [57, 57, 0, false],
      [57, 55, 2, false],
      [55, 55, 0, false],
      [55, 60, -5, true],
    ]);
  });

  it("starts empty once the chains have moved past play-by-play", () => {
    expect(
      currentSet({ ...field, ballOn: 40, lineToGain: 30 }, drives),
    ).toEqual([]);
  });

  it("is empty once the ball has changed hands", () => {
    expect(currentSet({ ...field, offense: "home" }, drives)).toEqual([]);
  });
});

describe("driveSeries", () => {
  it("splits a drive at each first down", () => {
    // BAL's drive under way. The neutral zone infraction on 1st & 10 leaves
    // 1st & 5 with the same line to gain, so it opens no new set.
    const series = driveSeries(drives.at(-1)!);
    expect(
      series.map((set) => [set.gainedBy, set.plays[0]!.downDistance]),
    ).toEqual([
      [null, "1st & 10 at BAL 14"],
      ["play", "1st & 10 at BAL 25"],
      ["play", "1st & 10 at BAL 38"],
    ]);
    expect(series[2]!.plays[1]!.downDistance).toBe("1st & 5 at BAL 43");
  });

  it("keeps a first down pushed back by a penalty in the same set", () => {
    const series = driveSeries({
      id: "1",
      offense: "home",
      description: null,
      result: null,
      isScore: false,
      inProgress: true,
      plays: [
        play({ id: "1", down: 1, distance: 10, start: 25 }),
        play({ id: "2", down: 1, distance: 15, start: 20, penalty: true }),
        play({ id: "3", down: 2, distance: 15, start: 20 }),
      ],
    });
    expect(series).toHaveLength(1);
    expect(series[0]!.plays).toHaveLength(3);
  });

  it("tells two first downs in a row apart", () => {
    const series = driveSeries({
      id: "1",
      offense: "home",
      description: null,
      result: null,
      isScore: false,
      inProgress: true,
      plays: [
        play({ id: "1", down: 1, distance: 10, start: 25 }),
        play({ id: "2", down: 1, distance: 10, start: 40 }),
        play({ id: "3", down: 1, distance: 10, start: 55, penalty: true }),
        play({ id: "4", down: 1, distance: 10, start: 60 }),
      ],
    });
    expect(series.map((set) => set.gainedBy)).toEqual([
      null,
      "play",
      "play",
      "penalty",
    ]);
  });
});

/** The id of the play in the fixture with this down and distance, or text. */
function idOf(label: string): string {
  const found = drives
    .flatMap((drive) => drive.plays)
    .find((play) => play.downDistance === label || play.text === label);
  if (!found) throw new Error(`No play ${label}`);
  return found.id;
}

describe("fieldAtPlay", () => {
  const steps = (id: string) =>
    fieldAtPlay(drives, id).set.map(({ from, to, yards }) => [from, to, yards]);

  it("places a snap against its own line to gain, through the set so far", () => {
    // BAL's opening drive: 2nd & 5 at ATL 19, caught to the ATL 8.
    const { field } = fieldAtPlay(drives, idOf("2nd & 5 at ATL 19"));
    expect(field).toEqual({
      offense: "away",
      ballOn: 19,
      lineToGain: 14,
      driveSpots: [65, 52, 45, 24, 19],
    });
    expect(steps(idOf("2nd & 5 at ATL 19"))).toEqual([
      [24, 19, 5],
      [19, 8, 11],
    ]);
  });

  it("lines a snap up at the line of scrimmage before playing it", () => {
    const id = idOf("2nd & 5 at ATL 19");
    const linedUp = fieldAtPlay(drives, id, "snap");
    expect(linedUp.field).toEqual(fieldAtPlay(drives, id).field);
    expect(linedUp.set.map(({ from, to }) => [from, to])).toEqual([[24, 19]]);
    // The snap joins this set: its row is held.
    expect(linedUp.waiting).toBe(true);
  });

  it("keeps the set that earned a first down until the next set's first snap", () => {
    // The 21-yard run on 3rd & 3 earned 1st & 10 at ATL 24.
    const id = idOf("1st & 10 at ATL 24");
    const linedUp = fieldAtPlay(drives, id, "snap");
    expect(linedUp.field).toMatchObject({ ballOn: 24, lineToGain: 14 });
    expect(linedUp.set.map(({ from, to, yards }) => [from, to, yards])).toEqual(
      [
        [52, 45, 7],
        [45, 45, 0],
        [45, 24, 21],
      ],
    );
    expect(linedUp.waiting).toBe(false);
    // Played, the new set starts.
    expect(steps(id)).toEqual([[24, 19, 5]]);
  });

  it("kicks a field goal try at the posts, the set left behind it", () => {
    const id = idOf("4th & Goal at ATL 3");
    const { field, kick, scoredBy } = fieldAtPlay(drives, id);
    expect(field?.lineToGain).toBeNull();
    // BAL attacks the home goal, at 0; the posts are on the end line behind.
    expect(kick).toEqual({
      id,
      action: "fieldGoal",
      from: 3,
      landed: -10,
      to: -10,
      returned: false,
    });
    expect(scoredBy).toBe("away");
    expect(steps(id)).toEqual([
      [8, 1, 7],
      [1, 3, -2],
      [3, 3, 0],
    ]);
  });

  it("punts from the line of scrimmage, fair caught where it landed", () => {
    // "K.Archer punts 56 yards to BLT 23, ..., fair catch".
    const id = idOf("4th & 6 at ATL 21");
    expect(fieldAtPlay(drives, id).kick).toEqual({
      id,
      action: "punt",
      from: 21,
      landed: 77,
      to: 77,
      returned: false,
    });
    expect(fieldAtPlay(drives, id, "snap").kick).toBeNull();
  });

  it("lights the end zone for the side that scored, defense or not", () => {
    // ATL, at home, returned BAL's fumble for the touchdown.
    const returned = drives[2]!.plays.at(-1)!;
    expect(returned.outcome).toBe("touchdown");
    expect(fieldAtPlay(drives, returned.id).scoredBy).toBe("home");
    expect(fieldAtPlay(drives, returned.id, "snap").scoredBy).toBeNull();
  });

  it("places an opening kickoff at the drive's first snap", () => {
    const kickoff = drives[1]!.plays[0]!;
    expect(kickoff.kind).toBe("kick");
    expect(fieldAtPlay(drives, kickoff.id)).toEqual({
      field: {
        offense: "home",
        ballOn: 17,
        lineToGain: 27,
        driveSpots: [17],
      },
      set: [],
      // BAL kicks 58 yards from its own 35 to the ATL 7, run back to the 17.
      kick: {
        id: kickoff.id,
        action: "kickoff",
        from: 65,
        landed: 7,
        to: 17,
        returned: true,
      },
      scoredBy: null,
      waiting: false,
    });
  });

  it("places a touchback rather than running it back", () => {
    // "K.Archer kicks 65 yards from ATL 35 to end zone, Touchback".
    const kickoff = drives[0]!.plays[0]!;
    expect(fieldAtPlay(drives, kickoff.id).kick).toMatchObject({
      from: 35,
      landed: 100,
      to: 65,
      returned: false,
    });
  });

  it("shows the snap before a stoppage", () => {
    expect(fieldAtPlay(drives, idOf("END QUARTER 1"))).toEqual(
      fieldAtPlay(drives, idOf("1st & 10 at BAL 25")),
    );
  });

  it("has no ball for a play it cannot find", () => {
    expect(fieldAtPlay(drives, "nope")).toEqual({
      field: null,
      set: [],
      kick: null,
      scoredBy: null,
      waiting: false,
    });
  });
});

/**
 * ATL's drive under way: 4 yards, 1 yard, then 7 on 3rd & 5 for a first
 * down. ESPN says where each left the ball, as it does mid-drive.
 */
const UNDER_WAY = extractPlayByPlay(
  makeSummary({
    home: { id: "1", abbreviation: "ATL" },
    away: { id: "33", abbreviation: "BAL" },
    live: true,
    drives: [
      {
        id: "d1",
        team: "home",
        plays: [
          {
            type: "Rush",
            period: 1,
            clock: "10:00",
            start: [1, 10, 30],
            end: [2, 6, 34],
            text: "B.Robinson up the middle to ATL 34 for 4 yards (R.Smith).",
          },
          {
            type: "Rush",
            period: 1,
            clock: "9:24",
            start: [2, 6, 34],
            end: [3, 5, 35],
            text: "B.Robinson left guard to ATL 35 for 1 yard (R.Smith).",
          },
          {
            type: "Pass Reception",
            period: 1,
            clock: "8:51",
            start: [3, 5, 35],
            end: [1, 10, 42],
            text: "K.Cousins pass short right to D.London to ATL 42 for 7 yards.",
          },
        ],
      },
    ],
  }),
);
const [run, shortRun, conversion] = playsInOrder(UNDER_WAY);
if (!run || !shortRun || !conversion) throw new Error("Three plays");

describe("fieldAfterPlay", () => {
  const field = (ballOn: number, lineToGain: number | null): FieldState => ({
    offense: "home",
    ballOn,
    lineToGain,
    driveSpots: [ballOn],
  });
  const bars = (id: string, after: FieldState | null) =>
    fieldAfterPlay(UNDER_WAY, id, after).set.map(({ from, to, yards }) => [
      from,
      to,
      yards,
    ]);

  it("rolls over to a new set, keeping the set that earned it", () => {
    const after = fieldAfterPlay(UNDER_WAY, conversion.id, field(42, 52));
    expect(after.field).toEqual({
      offense: "home",
      ballOn: 42,
      lineToGain: 52,
      driveSpots: [30, 34, 35, 42],
    });
    expect(bars(conversion.id, field(42, 52))).toEqual([
      [30, 34, 4],
      [34, 35, 1],
      [35, 42, 7],
    ]);
    // A new set starts with the next snap, so no row is held for it.
    expect(after.waiting).toBe(false);
  });

  it("moves to the next down of the same set, a row held for it", () => {
    const after = fieldAfterPlay(UNDER_WAY, run.id, field(34, 40));
    expect(after.field).toMatchObject({ ballOn: 34, lineToGain: 40 });
    expect(bars(run.id, field(34, 40))).toEqual([[30, 34, 4]]);
    expect(after.waiting).toBe(true);
  });

  it("runs the last bar to where the ball was spotted", () => {
    // Half the distance for a late hit, enforced after the whistle.
    expect(bars(shortRun.id, field(50, 50)).at(-1)).toEqual([34, 50, 16]);
  });

  it("leaves the play as it ended when the ball goes over", () => {
    expect(
      fieldAfterPlay(UNDER_WAY, conversion.id, {
        ...field(42, 32),
        offense: "away",
      }),
    ).toEqual(fieldAtPlay(UNDER_WAY, conversion.id));
    expect(fieldAfterPlay(UNDER_WAY, conversion.id, null)).toEqual(
      fieldAtPlay(UNDER_WAY, conversion.id),
    );
  });
});

describe("situationAfterPlay", () => {
  it("reads the next down from ESPN's word on the play", () => {
    expect(conversion.nextDown).toEqual({
      downDistance: "1st & 10 at ATL 42",
      distance: 10,
    });
    expect(situationAfterPlay(UNDER_WAY, conversion.id, "home")).toEqual({
      downDistance: "1st & 10 at ATL 42",
      possession: "team",
      isRedZone: false,
      timeouts: { team: null, opponent: null },
      lastPlay: null,
      drive: null,
      field: { offense: "home", ballOn: 42, lineToGain: 52, driveSpots: [42] },
    });
    expect(
      situationAfterPlay(UNDER_WAY, conversion.id, "away")?.possession,
    ).toBe("opponent");
  });

  it("says nothing where ESPN's word cannot be trusted", () => {
    const changed = (overrides: Partial<Play>) =>
      situationAfterPlay(
        UNDER_WAY.map((drive) => ({
          ...drive,
          plays: drive.plays.map((play) =>
            play.id === conversion.id ? { ...play, ...overrides } : play,
          ),
        })),
        conversion.id,
        "home",
      );
    expect(changed({ turnover: true })).toBeNull();
    expect(changed({ scoring: true, outcome: "touchdown" })).toBeNull();
    // Short on fourth down, the ball goes over.
    expect(changed({ down: 4, distance: 8 })).toBeNull();
    expect(changed({ down: 4, distance: 7 })).not.toBeNull();
    // Nothing from a drive under way whose plays give no next down.
    expect(
      situationAfterPlay(drives, idOf("1st & 10 at BAL 25"), "home"),
    ).toBeNull();
  });
});

describe("drivesThrough", () => {
  it("cuts the game off after a play, its drive told as under way", () => {
    const through = drivesThrough(drives, idOf("2nd & 5 at ATL 19"));
    expect(through).toHaveLength(1);
    expect(through[0]).toMatchObject({
      result: null,
      description: null,
      isScore: false,
      inProgress: true,
    });
    expect(through[0]!.plays.at(-1)!.downDistance).toBe("2nd & 5 at ATL 19");
  });

  it("keeps a drive whole once its last play is reached", () => {
    const through = drivesThrough(drives, idOf("4th & Goal at ATL 3"));
    expect(through).toEqual([drives[0]]);
  });

  it("shows nothing through a play it does not have", () => {
    expect(drivesThrough(drives, "not-a-play")).toEqual([]);
  });
});

describe("scoreAfter", () => {
  it("carries the last known score forward", () => {
    expect(scoreAfter(drives, idOf("1st & 10 at BAL 35"))).toEqual({
      home: 0,
      away: 0,
    });
    expect(scoreAfter(drives, drives[2]!.plays.at(-1)!.id)).toEqual({
      home: 7,
      away: 3,
    });
  });
});

describe("the game as it stood after a play", () => {
  // MIN at NO: MIN is away.
  const game = extractPlayByPlay(FULL_GAME);
  const plays = playsInOrder(game);
  const at = (pattern: RegExp) => {
    const found = plays.find((play) => pattern.test(play.text));
    if (!found) throw new Error(`No play ${pattern}`);
    return found;
  };

  it("knows which side called each timeout", () => {
    expect(at(/Timeout #1 by MIN at 03:42/).timeoutBy).toBe("away");
    expect(at(/Timeout #1 by NO at 04:08/).timeoutBy).toBe("home");
  });

  it("reads a timeout called by a gamebook code, not the team's abbreviation", () => {
    // ESPN's text calls Baltimore "BLT"; the team is "BAL".
    const [drive] = extractPlayByPlay({
      header: {
        competitions: [
          {
            competitors: [
              { id: "33", homeAway: "away", team: { abbreviation: "BAL" } },
              { id: "1", homeAway: "home", team: { abbreviation: "ATL" } },
            ],
          },
        ],
      },
      drives: {
        previous: [
          {
            id: "1",
            team: { id: "33" },
            plays: [
              {
                id: "9",
                type: { id: "21", text: "Timeout" },
                text: "Timeout #1 by BLT at 05:00.",
                period: { number: 2 },
              },
            ],
          },
        ],
      },
    });
    expect(drive?.plays[0]?.timeoutBy).toBe("away");
  });

  it("counts timeouts down through a half and grants them again after it", () => {
    const third = at(/Timeout #3 by MIN at 00:26/);
    expect(timeoutsLeft(game, third.id, 2)).toEqual({ home: 3, away: 0 });
    // Before MIN's third, two were gone.
    const second = at(/Timeout #2 by MIN at 00:50/);
    expect(timeoutsLeft(game, second.id, 2)).toEqual({ home: 3, away: 1 });
    const fourth = at(/Timeout #3 by NO at 02:45/);
    expect(timeoutsLeft(game, fourth.id, 4)).toEqual({ home: 0, away: 2 });
    expect(timeoutsLeft(game, null, 1)).toEqual({ home: 3, away: 3 });
  });

  it("fills in the quarter grid as the game went", () => {
    const opening = at(/40 yard field goal is GOOD/);
    expect(pointsByPeriod(game, opening.id, 1)).toEqual({
      home: [0],
      away: [3],
    });
    expect(pointsByPeriod(game, plays.at(-1)!.id, 4)).toEqual({
      home: [0, 7, 6, 0],
      away: [3, 3, 7, 10],
    });
  });
});

describe("scoreByDrive", () => {
  it("scores each drive before and after, carrying the score forward", () => {
    const scores = scoreByDrive(drives);
    expect(scores.get("d1")).toEqual({
      before: { home: 0, away: 0 },
      after: { home: 0, away: 3 },
    });
    // ATL's punt changes nothing; the returned fumble puts ATL up.
    expect(scores.get("d2")?.after).toEqual({ home: 0, away: 3 });
    expect(scores.get("d3")).toEqual({
      before: { home: 0, away: 3 },
      after: { home: 7, away: 3 },
    });
  });
});

describe("drivesByQuarter", () => {
  it("heads each quarter at the first drive with a play in it", () => {
    // BAL's last drive starts in the first quarter and runs into the second.
    expect(
      drivesByQuarter(drives).map((group) => [
        group.period,
        group.drives.map((drive) => drive.id),
      ]),
    ).toEqual([
      [1, ["d1", "d2", "d3", "d4", "d5"]],
      [2, ["d6"]],
    ]);
  });

  it("skips no quarter a drive spans", () => {
    const drive = (id: string, periods: number[]) => ({
      ...drives[0]!,
      id,
      plays: periods.map((period, index) =>
        play({ id: `${id}-${index}`, period }),
      ),
    });
    expect(
      drivesByQuarter([drive("a", [1, 2]), drive("b", [2])]).map((group) => [
        group.period,
        group.drives.map(({ id }) => id),
      ]),
    ).toEqual([
      [1, []],
      [2, ["a", "b"]],
    ]);
  });
});

function play(overrides: Partial<Play>): Play {
  return {
    id: "0",
    kind: "snap",
    action: null,
    outcome: null,
    headline: "A play",
    timeoutBy: null,
    text: "A play.",
    period: 1,
    clock: "10:00",
    downDistance: null,
    down: null,
    distance: null,
    start: null,
    scoring: false,
    turnover: false,
    penalty: false,
    end: null,
    nextDown: null,
    score: null,
    ...overrides,
  };
}
