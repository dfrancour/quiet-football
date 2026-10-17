import { type CSSProperties } from "react";
import { FootballMark } from "~/components/score/Football";
import {
  FIELD_YARDS,
  spotLabel,
  type FieldSide,
  type HomeYardLine,
} from "~/lib/field";
import { type DownStep, type KickFlight } from "~/lib/plays";
import { replayTiming } from "~/lib/replay-timing";
import { type FieldState } from "~/lib/score.schema";
import { type Team } from "~/lib/teams.schema";

interface FieldViewProps {
  home: Team;
  away: Team;
  /** Null between possessions: drawn with no ball. */
  field: FieldState | null;
  /** Oldest first. The ball is drawn where the last one ended. */
  set?: DownStep[];
  focusId?: string | null;
  /** Animates the focused snap: bar grows and the ball runs along. */
  drawFocus?: boolean;
  /**
   * A snap is lined up but not played; its row is reserved so the set does
   * not shift when the bar is drawn.
   */
  linedUp?: boolean;
  /** Drawn as an arc; a good field goal leaves no ball on the field. */
  kick?: KickFlight | null;
  /** Lights the end zone this side scored in. */
  scoredBy?: FieldSide | null;
}

/** Drawing units per yard; the end zones are ten yards deep. */
const UNIT = 10;
const END_ZONE = 10 * UNIT;
const WIDTH = FIELD_YARDS * UNIT + 2 * END_ZONE;
const HEIGHT = 250;
const MID = HEIGHT / 2;

/** The set-of-downs band, clear of the drive rule and the yard numbers. */
const TRACK_TOP = 36;
const TRACK_BOTTOM = HEIGHT - 56;
const MAX_ROW = 20;
/** The share of a row a bar fills; the rest is the gap between bars. */
const BAR_SHARE = 0.82;
/** Width of a no-gain snap's tick. */
const TICK = 6;
const OUTLINE = 2.5;

const FILL = { gold: "fill-gold", loss: "fill-loss", white: "fill-white" };
const STROKE = {
  gold: "stroke-gold",
  loss: "stroke-loss",
  white: "stroke-white",
};

/** A kick's arc along `y`, peaking higher the longer it travels. */
function kickPath(fromX: number, toX: number, y: number): string {
  const span = Math.abs(toX - fromX);
  const peak = Math.max(TRACK_TOP, y - Math.min(span * 0.35, 150));
  const control = 2 * peak - y;
  return `M ${fromX} ${y} Q ${(fromX + toX) / 2} ${control} ${toX} ${y}`;
}
/** The drive rule across the top of the field. */
const DRIVE_Y = 16;

/** Away on the left, home on the right (home goal, spot 0, at the right). */
function toX(spot: HomeYardLine): number {
  return END_ZONE + (FIELD_YARDS - spot) * UNIT;
}

const YARD_LINES = Array.from({ length: 19 }, (_, index) => (index + 1) * 5);

/** Lights up when scored in, after the play is drawn during a replay. */
function EndZone({
  team,
  side,
  lit,
  litAfterMs,
}: {
  team: Team;
  side: "left" | "right";
  lit: boolean;
  litAfterMs: number;
}) {
  const x = side === "left" ? 0 : WIDTH - END_ZONE;
  const center = x + END_ZONE / 2;
  return (
    <g>
      {team.color && (
        <rect
          x={x}
          y={0}
          width={END_ZONE}
          height={HEIGHT}
          fill={`#${team.color}`}
          style={{
            opacity: lit ? 0.95 : 0.55,
            transition: "opacity 400ms ease-out",
            transitionDelay: lit ? `${litAfterMs}ms` : "0ms",
          }}
        />
      )}
      {lit && (
        <rect
          x={x}
          y={0}
          width={END_ZONE}
          height={HEIGHT}
          className="animate-field-light fill-white"
          opacity={0}
          style={{ animationDelay: `${litAfterMs}ms` }}
        />
      )}
      <text
        x={center}
        y={MID}
        transform={`rotate(${side === "left" ? -90 : 90} ${center} ${MID})`}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-sans font-bold"
        fontSize={40}
        letterSpacing={8}
        opacity={0.75}
      >
        {team.abbreviation}
      </text>
    </g>
  );
}

const KICKED: Record<KickFlight["action"], string> = {
  punt: "punted",
  kickoff: "kicked off",
  fieldGoal: "field goal try",
};

function describe(
  field: FieldState | null,
  set: DownStep[],
  kick: KickFlight | null,
  scoredBy: FieldSide | null,
  home: Team,
  away: Team,
): string {
  if (!field) return "Field: nobody has the ball";
  const offense = field.offense === "home" ? home : away;
  const spot = (value: number) =>
    spotLabel(value, home.abbreviation, away.abbreviation);

  const parts = [`${offense.abbreviation} ball on ${spot(field.ballOn)}`];
  if (field.lineToGain !== null) {
    parts.push(`line to gain ${spot(field.lineToGain)}`);
  }
  const end = set.at(-1)?.to;
  if (end !== undefined && end !== field.ballOn) {
    parts.push(`play ended at ${spot(end)}`);
  }
  const setStart = set[0]?.from;
  if (setStart !== undefined && setStart !== field.ballOn) {
    parts.push(`set of downs began at ${spot(setStart)}`);
  }
  const start = field.driveSpots[0];
  if (field.driveSpots.length > 1 && start !== undefined) {
    parts.push(`drive began at ${spot(start)}`);
  }
  if (kick) {
    parts.push(
      kick.action === "fieldGoal"
        ? `${KICKED[kick.action]} from ${spot(kick.from)}`
        : `${KICKED[kick.action]} from ${spot(kick.from)} to ${spot(kick.landed)}`,
    );
    if (kick.returned) parts.push(`returned to ${spot(kick.to)}`);
  }
  if (scoredBy) {
    parts.push(`${(scoredBy === "home" ? home : away).abbreviation} scored`);
  }
  return parts.join(", ");
}

/**
 * One snap as a bar from its spot to the next: square at the snap, pointed
 * where the ball went, so a loss points back. A run is solid, a pass open. A
 * no-gain snap is a tick.
 */
function StepBar({
  step,
  y,
  height,
  dimmed,
  drawn,
  drawAfterMs = 0,
}: {
  step: DownStep;
  y: number;
  height: number;
  dimmed: boolean;
  drawn: boolean;
  /** Delay before growing, for a bar that follows another. */
  drawAfterMs?: number;
}) {
  const fromX = toX(step.from);
  const toXValue = toX(step.to);
  const tone = step.penalty ? "gold" : step.yards < 0 ? "loss" : "white";
  const thrown = step.action === "pass";
  // Inset the open shape by its stroke so it covers the same area as a solid.
  const paint = thrown
    ? {
        className: `fill-none ${STROKE[tone]}`,
        strokeWidth: OUTLINE,
        strokeLinejoin: "round" as const,
      }
    : { className: FILL[tone] };
  const inset = thrown ? OUTLINE / 2 : 0;
  const width = Math.abs(toXValue - fromX);

  if (width === 0) {
    return (
      <rect
        data-step={step.id}
        x={fromX - TICK / 2 + inset}
        y={y + inset}
        width={TICK - 2 * inset}
        height={height - 2 * inset}
        {...paint}
        opacity={dimmed ? 0.3 : 0.6}
      />
    );
  }

  const ahead = toXValue > fromX ? 1 : -1;
  const point = Math.min(height * 0.6, width);
  const top = y + inset;
  const bottom = y + height - inset;
  const start = fromX + ahead * inset;
  const tip = toXValue - ahead * inset;
  const d = [
    `M ${start} ${top}`,
    `L ${tip - ahead * point} ${top}`,
    `L ${tip} ${y + height / 2}`,
    `L ${tip - ahead * point} ${bottom}`,
    `L ${start} ${bottom}`,
    "Z",
  ].join(" ");

  return (
    <path
      data-step={step.id}
      d={d}
      {...paint}
      className={
        drawn ? `${paint.className} animate-field-draw` : paint.className
      }
      style={
        drawn
          ? {
              transformOrigin: ahead === 1 ? "left center" : "right center",
              animationDelay: `${drawAfterMs}ms`,
            }
          : undefined
      }
      opacity={dimmed ? 0.35 : 0.8}
    />
  );
}

/**
 * Line of scrimmage, line to gain, and the current set of downs as stacked
 * bars, with the drive as a rule along the top.
 *
 * Everything here is a spoiler; the caller shows it only when allowed.
 */
export function FieldView({
  home,
  away,
  field,
  set = [],
  focusId = null,
  drawFocus = false,
  linedUp = false,
  kick = null,
  scoredBy = null,
}: FieldViewProps) {
  const scrimmageX = field ? toX(field.ballOn) : null;
  const end = kick?.to ?? set.at(-1)?.to ?? field?.ballOn;
  const ballX = end === undefined ? null : toX(end);
  const ballShown = !(kick?.action === "fieldGoal" && scoredBy !== null);

  // The set stacks from the top so each snap keeps its place as the next is
  // added. Rows shrink only once the set would overrun the band.
  const rows = Math.max(1, set.length + (linedUp ? 1 : 0));
  const row = Math.min(MAX_ROW, (TRACK_BOTTOM - TRACK_TOP) / rows);
  const barHeight = row * BAR_SHARE;
  const barY = (index: number) =>
    TRACK_TOP + index * row + (row - barHeight) / 2;
  const kickY = TRACK_BOTTOM - MAX_ROW / 2;
  const ballY = DRIVE_Y;

  const focus = set.find((step) => step.id === focusId);
  const run =
    drawFocus && !kick && focus && ballX !== null
      ? ({
          "--run-dx": `${toX(focus.from) - ballX}px`,
        } as CSSProperties)
      : null;

  const returnRun =
    drawFocus && kick?.returned && ballX !== null
      ? ({ "--run-dx": `${toX(kick.landed) - ballX}px` } as CSSProperties)
      : null;
  // So a score lights up as it lands.
  const { drawMs } = replayTiming();
  const drawnFor = !drawFocus ? 0 : kick?.returned ? 2 * drawMs : drawMs;

  const setStart = set[0]?.from ?? null;
  const driveStart = field?.driveSpots[0] ?? null;
  const priorDrive =
    driveStart !== null && setStart !== null && driveStart !== setStart
      ? [toX(driveStart), toX(setStart)]
      : driveStart !== null && scrimmageX !== null && set.length === 0
        ? [toX(driveStart), scrimmageX]
        : null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full overflow-hidden rounded-lg ring-1 ring-white/5"
      role="img"
      aria-label={describe(field, set, kick, scoredBy, home, away)}
      style={{ "--field-draw": `${drawMs}ms` } as CSSProperties}
    >
      <rect width={WIDTH} height={HEIGHT} className="fill-turf" />
      {Array.from({ length: 5 }, (_, index) => (
        <rect
          key={index}
          x={END_ZONE + (index * 20 + 10) * UNIT}
          y={0}
          width={10 * UNIT}
          height={HEIGHT}
          className="fill-white"
          opacity={0.025}
        />
      ))}
      <EndZone
        team={away}
        side="left"
        lit={scoredBy === "home"}
        litAfterMs={drawnFor}
      />
      <EndZone
        team={home}
        side="right"
        lit={scoredBy === "away"}
        litAfterMs={drawnFor}
      />

      {[0, FIELD_YARDS].map((goal) => (
        <line
          key={goal}
          x1={toX(goal)}
          x2={toX(goal)}
          y1={0}
          y2={HEIGHT}
          className="stroke-white"
          strokeWidth={2}
          opacity={0.45}
        />
      ))}

      {YARD_LINES.map((yard) => (
        <line
          key={yard}
          x1={toX(yard)}
          x2={toX(yard)}
          y1={0}
          y2={HEIGHT}
          className="stroke-white"
          strokeWidth={1.5}
          opacity={yard % 10 === 0 ? 0.16 : 0.07}
        />
      ))}

      {YARD_LINES.filter((yard) => yard % 10 === 0).map((yard) => (
        <text
          key={yard}
          x={toX(yard)}
          y={HEIGHT - 20}
          textAnchor="middle"
          className="fill-white font-sans font-semibold tabular-nums"
          fontSize={30}
          letterSpacing={2}
          opacity={0.32}
        >
          {Math.min(yard, FIELD_YARDS - yard)}
        </text>
      ))}

      {field && ballX !== null && scrimmageX !== null && (
        <g>
          {priorDrive && (
            <rect
              x={Math.min(...priorDrive)}
              y={0}
              width={Math.abs(priorDrive[1]! - priorDrive[0]!)}
              height={HEIGHT}
              className="fill-white"
              opacity={0.05}
            />
          )}

          {driveStart !== null && toX(driveStart) !== ballX && (
            <g className="fill-white stroke-white" opacity={0.55}>
              <line
                x1={toX(driveStart)}
                x2={run || kick ? scrimmageX : ballX}
                y1={DRIVE_Y}
                y2={DRIVE_Y}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {run && scrimmageX !== ballX && (
                <rect
                  key={`rule-${focusId}`}
                  x={Math.min(scrimmageX, ballX)}
                  y={DRIVE_Y - 1.5}
                  width={Math.abs(ballX - scrimmageX)}
                  height={3}
                  stroke="none"
                  className="animate-field-draw"
                  style={{
                    transformOrigin:
                      scrimmageX < ballX ? "left center" : "right center",
                  }}
                />
              )}
              <circle cx={toX(driveStart)} cy={DRIVE_Y} r={7} />
            </g>
          )}

          {setStart !== null && setStart !== field.ballOn && (
            <line
              x1={toX(setStart)}
              x2={toX(setStart)}
              y1={0}
              y2={HEIGHT}
              className="stroke-white"
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.45}
            />
          )}

          {field.lineToGain !== null && (
            <line
              x1={toX(field.lineToGain)}
              x2={toX(field.lineToGain)}
              y1={0}
              y2={HEIGHT}
              className="stroke-gold"
              strokeWidth={3.5}
              opacity={0.9}
            />
          )}
          <line
            x1={scrimmageX}
            x2={scrimmageX}
            y1={0}
            y2={HEIGHT}
            className="stroke-scrimmage"
            strokeWidth={3.5}
          />

          {set.map((step, index) => (
            <StepBar
              key={step.id}
              step={step}
              y={barY(index)}
              height={barHeight}
              dimmed={focusId !== null && step.id !== focusId}
              drawn={run !== null && step.id === focusId}
            />
          ))}

          {kick && (
            <path
              key={`kick-${kick.id}-${drawFocus}`}
              data-kick={kick.action}
              d={kickPath(toX(kick.from), toX(kick.landed), kickY)}
              pathLength={1}
              className={
                drawFocus
                  ? "animate-field-kick fill-none stroke-white"
                  : "fill-none stroke-white"
              }
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={drawFocus ? 1 : undefined}
              opacity={
                kick.action === "fieldGoal" && scoredBy === null ? 0.35 : 0.75
              }
            />
          )}

          {kick?.returned && (
            <StepBar
              key={`return-${kick.id}-${drawFocus}`}
              step={{
                id: `${kick.id}-return`,
                down: null,
                from: kick.landed,
                to: kick.to,
                yards: Math.abs(kick.to - kick.landed),
                penalty: false,
                action: "run",
              }}
              y={kickY - (MAX_ROW * BAR_SHARE) / 2}
              height={MAX_ROW * BAR_SHARE}
              dimmed={false}
              drawn={drawFocus}
              drawAfterMs={drawMs}
            />
          )}

          {ballShown && (
            <g
              key={run ? `run-${focusId}` : kick ? `land-${kick.id}` : "ball"}
              className={
                run
                  ? "animate-field-run"
                  : kick && drawFocus
                    ? kick.returned
                      ? "animate-field-return"
                      : "animate-field-land"
                    : undefined
              }
              style={run ?? returnRun ?? undefined}
            >
              <FootballMark
                cx={ballX}
                cy={ballY}
                radius={16}
                className="fill-ink-muted"
              />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
