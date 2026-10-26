import Link from "next/link";
import { type ReactNode } from "react";
import { Redacted } from "~/components/common/Redacted";
import { CoveredTeam } from "~/components/playoffs/CoveredTeam";
import { TeamLogo } from "~/components/team/TeamLogo";
import {
  divisionalFeeders,
  type Bracket as BracketData,
  type BracketGame,
  type BracketSide,
  type ConferenceBracket,
  type Feeder,
  type GateGame,
} from "~/lib/playoffs";
import { teamPath } from "~/lib/routes";
import { weekParam } from "~/lib/season-calendar";
import { scoreShown, type ScoreShown } from "~/lib/spoilers";
import { tintStyle } from "~/lib/team-tint";
import { type Team } from "~/lib/teams.schema";
import { cn } from "~/lib/utils";

interface BracketProps {
  bracket: BracketData;
  totalWeeks: number;
  /** Whether a game's result may be shown. */
  isShown: (game: GateGame) => boolean;
  /** Whether a playoff matchup may be shown (`playoffs.ts`). */
  isOpen: (gate: readonly GateGame[]) => boolean;
  /** The viewer's teams, each line tinted in its team's color. */
  favorites: ReadonlySet<string>;
}

type Context = Omit<BracketProps, "bracket">;

/** Every card is two lines, so each round's cards line up with their feeders. */
const CARD = "w-28 shrink-0";
const LINE = "flex h-6 items-center gap-1.5 px-1";
/** Elbow, then stub: the gap between rounds. */
const GAP = "w-3 shrink-0";

const ROUND_HEADINGS = ["Wild Card", "Divisional", "Conference", "Super Bowl"];

function Seed({ seed }: { seed: number | null }) {
  return (
    <span className="text-ink-faint text-micro w-2.5 shrink-0 text-right font-mono tabular-nums">
      {seed !== null && (
        <>
          <span className="sr-only">Seed </span>
          {seed}
        </>
      )}
    </span>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(CARD, "border-edge bg-surface rounded-sm border py-0.5")}
    >
      {children}
    </div>
  );
}

function TeamLine({
  team,
  seed,
  href,
  score,
  outcome,
  favorite,
  reach,
}: {
  team: Team;
  seed: number | null;
  href: string;
  score: ScoreShown;
  /**
   * Which way its tap area reaches past the card: away from the card's other
   * line, so a line drawn 24px tall is still about 36px to tap.
   */
  reach: "up" | "down";
  /** Known only once the game is seen. */
  outcome: "won" | "lost" | null;
  favorite: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        LINE,
        "hover:bg-surface-sunken focus-visible:outline-accent-strong relative rounded-sm transition-colors focus-visible:outline-2",
        "after:absolute after:inset-x-0",
        reach === "up"
          ? "after:-top-2.5 after:bottom-0"
          : "after:top-0 after:-bottom-2.5",
        favorite && "team-tint",
        outcome === "lost" && "opacity-45",
      )}
      style={favorite ? tintStyle(team) : undefined}
    >
      <Seed seed={seed} />
      <TeamLogo team={team} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs tracking-wide",
          outcome === "won" ? "text-ink font-semibold" : "text-ink-muted",
        )}
      >
        {team.abbreviation}
      </span>
      {score.kind !== "none" && (
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            outcome === "won" ? "text-ink font-semibold" : "text-ink-muted",
          )}
        >
          {score.kind === "hidden" ? <Redacted /> : score.text}
        </span>
      )}
    </Link>
  );
}

function CoveredLines() {
  return (
    <>
      {[0, 1].map((line) => (
        <span key={line} className={LINE}>
          <Seed seed={null} />
          <CoveredTeam />
        </span>
      ))}
    </>
  );
}

/** A matchup not yet set. */
function OpenCard() {
  return (
    <Card>
      {[0, 1].map((line) => (
        <span key={line} className={cn(LINE, "text-ink-faint")} aria-hidden>
          <Seed seed={null} />
          <span className="text-xs">—</span>
        </span>
      ))}
    </Card>
  );
}

/** The winner's side, once the viewer may know it. */
function decided(game: BracketGame, context: Context): BracketSide | null {
  if (!context.isOpen(game.gate) || !context.isShown(game)) return null;
  const { home, away } = game;
  if (game.status !== "final" || home.score === null || away.score === null) {
    return null;
  }
  if (home.score === away.score) return null;
  return home.score > away.score ? home : away;
}

function GameCard({ game, context }: { game: BracketGame; context: Context }) {
  if (!context.isOpen(game.gate)) {
    return (
      <Card>
        <CoveredLines />
      </Card>
    );
  }
  const { totalWeeks, isShown, favorites } = context;
  const started = game.status === "in_progress" || game.status === "final";
  const winner = decided(game, context);
  const week = weekParam(totalWeeks, game.week);
  return (
    <Card>
      {[game.away, game.home].map((side, index) => (
        <TeamLine
          key={side.team.teamId}
          reach={index === 0 ? "up" : "down"}
          team={side.team}
          seed={side.seed}
          href={teamPath(side.team.abbreviation, week)}
          score={scoreShown(started, side.score, isShown(game))}
          outcome={winner === null ? null : winner === side ? "won" : "lost"}
          favorite={favorites.has(side.team.teamId)}
        />
      ))}
    </Card>
  );
}

function ByeCard({
  conference,
  context,
}: {
  conference: ConferenceBracket;
  context: Context;
}) {
  const { bye } = conference;
  if (!bye) return <OpenCard />;
  if (!context.isOpen(bye.gate)) {
    return (
      <Card>
        <span className={LINE}>
          <Seed seed={null} />
          <CoveredTeam />
        </span>
        <span className={cn(LINE, "text-ink-faint text-xs italic")}>
          <Seed seed={null} />
          Bye
        </span>
      </Card>
    );
  }
  return (
    <Card>
      <TeamLine
        reach="up"
        team={bye.team}
        seed={bye.seed}
        href={teamPath(bye.team.abbreviation)}
        score={{ kind: "none" }}
        outcome={null}
        favorite={context.favorites.has(bye.team.teamId)}
      />
      <span className={cn(LINE, "text-ink-faint text-xs italic")}>
        <Seed seed={null} />
        Bye
      </span>
    </Card>
  );
}

/**
 * A card and what feeds it. `advanced` draws a child's line solid: its winner
 * is known to have gone on. Unlinked children sit in place with no lines,
 * when who feeds whom is not yet known.
 */
interface Branch {
  key: string;
  card: ReactNode;
  children: Branch[];
  linked: boolean;
  advanced: boolean;
  /** Space around the branch, the same above and below so lines stay centred. */
  inset?: string;
}

function Elbow({ first, advanced }: { first: boolean; advanced: boolean }) {
  return (
    <span className={cn(GAP, "relative self-stretch")} aria-hidden>
      <span
        className={cn(
          "absolute inset-x-0 border-r",
          first ? "top-1/2 bottom-0 border-t" : "top-0 bottom-1/2 border-b",
          advanced ? "border-ink-muted" : "border-edge-strong",
        )}
      />
    </span>
  );
}

function BranchView({ branch }: { branch: Branch }) {
  if (branch.children.length === 0) {
    // Room between cards for each line's tap area to reach into.
    return <div className="py-2">{branch.card}</div>;
  }
  const lit = branch.linked && branch.children.some((child) => child.advanced);
  return (
    <div className="flex items-center">
      <div className="flex flex-col">
        {branch.children.map((child, index) => (
          <div key={child.key} className="flex items-stretch">
            <div className={child.inset}>
              <BranchView branch={child} />
            </div>
            {branch.linked ? (
              <Elbow first={index === 0} advanced={child.advanced} />
            ) : (
              <span className={GAP} />
            )}
          </div>
        ))}
      </div>
      <span
        className={cn(
          GAP,
          "border-t",
          !branch.linked
            ? "border-transparent"
            : lit
              ? "border-ink-muted"
              : "border-edge-strong",
        )}
        aria-hidden
      />
      {branch.card}
    </div>
  );
}

function gameBranch(
  game: BracketGame | undefined,
  key: string,
  context: Context,
  children: Branch[] = [],
  linked = true,
): Branch {
  return {
    key: game?.gameId ?? key,
    card: game ? <GameCard game={game} context={context} /> : <OpenCard />,
    children,
    linked,
    advanced: game ? decided(game, context) !== null : false,
  };
}

function feederBranch(
  feeder: Feeder | null,
  key: string,
  conference: ConferenceBracket,
  context: Context,
): Branch {
  if (feeder?.kind === "bye") {
    return {
      key: "bye",
      card: <ByeCard conference={conference} context={context} />,
      children: [],
      linked: true,
      // A bye always goes on; drawing it so gives nothing away.
      advanced: conference.bye !== null && context.isOpen(conference.bye.gate),
    };
  }
  return gameBranch(feeder?.game, key, context);
}

/**
 * Wild Card games feed the Divisional slots they filled, which only the
 * results decide; until the viewer may see that round, the Wild Card column
 * is listed by seed with no lines into it.
 */
function conferenceBranch(
  conference: ConferenceBracket,
  context: Context,
): Branch {
  const [wildCard, divisional, championship] = conference.rounds;
  const divGames = divisional?.games ?? [];
  const feeders = divisionalFeeders(conference);
  const linked =
    feeders !== null && divGames.every((game) => context.isOpen(game.gate));

  const pairs: (Feeder | null)[][] = linked
    ? feeders
    : (() => {
        const column: (Feeder | null)[] = [
          conference.bye ? { kind: "bye" } : null,
          ...(wildCard?.games ?? []).map(
            (game): Feeder => ({ kind: "game", game }),
          ),
        ];
        while (column.length < 4) column.push(null);
        return [column.slice(0, 2), column.slice(2, 4)];
      })();

  const divBranches = [0, 1].map((slot) =>
    gameBranch(
      divGames[slot],
      `${conference.conference}-div-${slot}`,
      context,
      (pairs[slot] ?? []).map((feeder, index) =>
        feederBranch(
          feeder,
          `${conference.conference}-wc-${slot}-${index}`,
          conference,
          context,
        ),
      ),
      linked,
    ),
  );

  return gameBranch(
    championship?.games[0],
    `${conference.conference}-conf`,
    context,
    divBranches,
  );
}

/**
 * The postseason as it flows: each conference's rounds left to right, NFC
 * above AFC, meeting in the Super Bowl. A matchup is covered until the round
 * before it is seen; once a game is, its winner's line is drawn and its loser
 * fades.
 */
export function Bracket({ bracket, ...context }: BracketProps) {
  // Apart enough to read as two halves.
  const conferences = bracket.conferences.map((conference) => ({
    ...conferenceBranch(conference, context),
    inset: "py-4",
  }));
  const root = gameBranch(
    bracket.superBowl ?? undefined,
    "super-bowl",
    context,
    conferences,
  );

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="flex w-max flex-col">
        {/* The conferences' inset is for between them, so the tree tucks up
            under the headings by as much; a margin on the tree would overflow
            this scrolling box. */}
        <div className="-mb-3 flex pl-5">
          {ROUND_HEADINGS.map((heading, index) => (
            <span key={heading} className="flex">
              {index > 0 && <span className="w-6 shrink-0" />}
              <h3 className={cn(CARD, "label-eyebrow")}>{heading}</h3>
            </span>
          ))}
        </div>
        <div className="flex">
          {/* Each conference's name beside its half of the tree. */}
          <div className="flex w-5 shrink-0 flex-col">
            {bracket.conferences.map(({ conference }) => (
              <span
                key={conference}
                className="text-ink-muted text-micro tracking-eyebrow flex flex-1 rotate-180 items-center justify-center font-semibold [writing-mode:vertical-rl]"
              >
                {conference}
              </span>
            ))}
          </div>
          <BranchView branch={root} />
        </div>
      </div>
    </div>
  );
}
