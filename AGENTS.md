# Quiet Football

An NFL season browser with no ads, no betting lines, and no result shown
until the viewer asks for it. Odds, fantasy points, hot takes and engagement
hooks are out of scope. Any feature that could reveal a result must follow the
spoiler rules below.

The schedule is the navigation: pick a week and the page shows what that game
warrants — play-by-play and a recap link once played, score and plays while
live, or a kickoff time if upcoming.

It is a static site: every page is prerendered HTML and the browser fetches
the data itself from ESPN. There is no server, no database and nothing
persisted beyond the viewer's own choices and the weeks already played.
`pnpm build` writes `out/`, which
Vercel (or any static host) serves.

---

## Data model

The repository carries no data. Everything is fetched from ESPN (and the
recap dataset, for recaps) by the browser, through TanStack Query, and kept
for the session. What a visit can leave for the next it saves in
`localStorage` (`src/lib/week-store.ts`): a settled week's scoreboard for
good, a week still ahead and the team registry for as long as they are
trusted. **Nothing is stored twice**, nothing is fetched unless a page is
drawing it, and nothing is fetched again just because the tab was looked at.
ESPN sends `max-age=1` on everything, so the browser's own cache is no help;
the query layer is the cache.

| Query (`src/lib/queries.ts`) | Holds                                                   | Fetched again                                       |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `standings`                  | ESPN's standings: teams by division, seeds, clinches    | after `marksStaleMs`, and only if marks are shown   |
| `teams`                      | The 32 teams, with conference, division, color and logo | never in a session; saved for `teamsStaleMs`        |
| `week`, per week             | One week's scoreboard: its games, clocks and situations | see "Only a week with a game under way..."          |
| `play-by-play`, per game     | ESPN's summary of a game, trimmed to its drives         | as the scoreboard shows a new play; once when over  |
| `recaps`                     | The season's file from the recap dataset                | on `recapsPoll`'s schedule while a recap is awaited |

Playoff marks are not a query of their own: `playoffMarksQuery` is the
standings query with a `select`.

The viewer's own state lives in `localStorage` (`src/lib/local-store.ts`):
the week caught up through per season, the favorite team, watch progress and
broadcast delays.

### Games are held once for the league

A game names both sides by team id (`home.teamId`, `away.teamId`). A per-team
schedule is derived by `buildTeamSchedule()` (`src/lib/team-view.ts`), which
resolves the opponent and orients the game from that team's side. Do not
build per-team schedules anywhere else.

- `SeasonGame` / `SeasonFile` — what a week's scoreboard yields (`season.schema.ts`)
- `TeamGame` / `TeamSchedule` — what is **derived** (`team-view.ts`)

Derived types are plain interfaces, not Zod schemas. Zod is for untrusted
input at the boundary: ESPN's payloads and the recap dataset.

### Game ids are ESPN's

`gameId` is ESPN's event id. Everything keyed by game — watch progress,
broadcast delays, recaps, the summary query — uses it. Never parse meaning
out of an id or construct one to look a game up. `teamId` is ESPN's team id;
URLs use the abbreviation.

URLs name a game by team and week (a team plays once a week). The week is the
one the game was fetched under, which ESPN keeps on a postponed game.

### Only the current season

The app shows one season: the current one (`currentSeason()`), or between
March and the schedule's release in May, when ESPN has none, the one before.
`useSeason()` fetches every week of the current season at once, waiting on
nothing first; only when its week 1 arrives empty does it read the season
before. There is no season picker and no `?season=`.

### Playoff games are weeks after the regular season

A season's playoff games sit after its regular season, each round as the
week after the one before: Wild Card is week 19 of an 18-week season, then
Divisional, Conference, Super Bowl (`season-calendar.ts`). A team still plays
once a week, so nothing keyed by week changes. URLs name the round
(`?week=wild-card`, `weekParam()`), and pages name it ("Wild Card", "WC").

ESPN numbers the postseason from 1 with the Pro Bowl before the Super Bowl
(week 5), so `weekScoreboardUrl()` maps each round to ESPN's week and
`seasonGamesFromScoreboard()` finds the Super Bowl by its headline. A round
ESPN has not set lists "TBD" teams with negative ids; those events are
dropped, so the round is empty until its matchups arrive. A round's matchups
come from the week before it, so a round is asked of ESPN only once that
week is settled (`roundIsSet`); until then it is an empty week, and ESPN
is not asked to say so through the regular season.

Records and standings count the regular season only (`isRegularSeason()`);
a playoff game's `recordsBefore` is the record the team finished with.

### Standings are derived; seeds and clinching are ESPN's

`buildStandings()` (`src/lib/standings.ts`) computes W, L, T, Pct and streak
from the regular season's finals. Within a division it applies the NFL
tiebreakers in order — head-to-head, division record, common games,
conference record — pairwise, and stops there.

Conference and division live on the team. The registry is built from ESPN's
standings endpoint (`teamRegistryFromEspn()`, `src/lib/team-fetch.ts`), which
names every team under its division and answers cross-origin requests; the
teams endpoint does neither. A team outside a known conference or division
is refused, since it would silently drop out of the standings. The one thing
the standings omit is each team's color, so `teamsQuery` reads it from the
season's first week, in which every team plays. The registry is saved for
the next visit and trusted for `teamsStaleMs`, so a return visit asks for
the standings only when the marks are shown.

Playoff seeds and clinch codes (`x`, `y`, `z`, `*`, `**`, `e`) are not derived:
they need the full multi-team tiebreakers and every remaining result.
`playoffMarksQuery` reads them off the same standings payload
(`src/lib/playoff-marks.ts`), so one request serves both, and only while a
page can show them (`usePlayoffMarks(season, wanted)`): the standings caught
up through the regular season, or the bracket. The standings show a seed only
inside the field (`PLAYOFF_SEEDS`, seven).

### One query per week is the source of truth

ESPN's week scoreboard is the only source of status, score, clock and
situation, for every page. `readWeek()` (`src/lib/season-sync.ts`) turns a
payload into a `WeekBoard` — the games as `SeasonGame`s, each game's clock as
a `BoardGame`, and the raw payload for a team's `LiveScore`
(`extractTeamScore`) — and `seasonFromWeeks()` assembles the `SeasonFile`.
`useSeason()` (`src/hooks/useLeague.ts`) runs every week's query and is null
until all have arrived, so a page never shows half a season.

Whether a game is live or final is decided only by that scoreboard:
`gamePhase()` reads a game as live from kickoff until ESPN calls it final,
however long it runs. There is no merging and nothing to move backwards: a
week's newest fetch simply replaces its last.

### Only a week with a game under way is polled

`weekActivity()` reads each week from its own games, and `weekQuery` sets
its policy from that:

| Activity  | When                                               | Policy                                                                           |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `live`    | a game has kicked off and is not final or canceled | polled every `scoreConfig.livePollMs` while mounted; not saved                   |
| `settled` | every game is final or canceled                    | never fetched again; saved for good                                              |
| `ahead`   | anything else: games to come, a round not yet set  | trusted for `aheadStaleMs` (hours) from when it arrived, to catch flexing; saved |

Polling runs only while a page is open and visible (Query's default), so a
viewer looking at an old week costs ESPN nothing. There is no refresh
control: nothing the viewer does asks ESPN for a week sooner than its
policy says.

A game's clock is noted as each poll lands (`noteGameClock`), so a delayed
broadcast can be shown its own moment.

A week fetched without a game under way is saved, trimmed to the schema's
fields (about 11 KB), under its season and week with when it arrived;
`fetchWeek` reads the saved copy before asking ESPN and uses it while it is
still good: for good once settled, for `aheadStaleMs` while ahead, and not
at all once a saved game's kickoff has passed. So a return visit fetches
only the week in play, and a week ahead at most every few hours across
visits, not every page load. Storage holds one season: saving a week lets
go of any other season's. A copy that cannot be read, or was saved under an
older `FORMAT`, is dropped and fetched; blocked or full storage is simply
not saved to.

A poll that keeps failing backs off: its interval doubles for each failure
in a row, up to `pollBackoffDoublings`, and never runs sooner than a
`Retry-After` asked (`pollEvery`). Query's one retry waits for `Retry-After`
too.

### Play-by-play comes from ESPN's summary

`playByPlayQuery` reads ESPN's `summary` endpoint and trims it with
`extractPlayByPlay()` (`src/lib/plays.ts`) as it arrives, since the payload is
hundreds of kilobytes, mostly not plays: the heaviest call the app makes, so
it is made only when the plays will be drawn. The team page asks for the
selected game's plays when the game is shown, when the viewer has a place in
it, or when they ask to watch it (`playsWanted`); a covered game nobody has
started costs nothing, and its panel's **Watch from kickoff** asks for the
plays and starts on them as they come (`onLoadPlays`, `replay.start`).

A live game's summary is not on a timer of its own: `usePlayByPlay` reads it
again when the week's scoreboard, already being polled, shows something new
about the game (its clock, score or last play, the `mark`), with a slow poll
behind that (`summaryFallbackMs`) in case the scoreboard missed a play. It
stops once the summary's own header calls the game over; a finished game's
is fetched once, regardless of spoiler setting, and with spoilers hidden it
is shown only as far as the viewer has watched. When a game stops being live
before its summary said so, `usePlayByPlay` reads it once more for the last
plays.

### Every upstream call goes through `fetchUpstream`

`src/lib/upstream.ts` is the only code that calls ESPN or the recap dataset.
Every endpoint used answers cross-origin requests (ESPN's `teams` endpoint
does not, which is why the registry comes from the standings), so the
browser calls them directly; it adds a timeout (8 seconds; ESPN answers in
well under one) and turns a bad status into an `UpstreamError`, keeping any
`Retry-After` as `retryAfterMs`. Caching, retries and backoff belong to the
query layer. The root layout preconnects to ESPN's API
and logo hosts so the connections are open by the time the script runs. If ESPN
ever stops allowing cross-origin reads, the fix is one proxy in front of
`site.api.espn.com` behind this module, or a slim committed data file for
what changes slowly, not a server.

A first visit's reads start before the script has loaded: an inline script
in the page's head (`PREFETCH_SCRIPT`, `src/lib/prefetch.ts`) starts a fetch
of each regular-season week and the standings that no earlier visit saved,
and `fetchUpstream` takes the started response instead of asking again, so
ESPN's answers are on the way while the bundle downloads. It skips anything
saved, good or not, so a return visit starts nothing from the head, and a
prefetch that failed is simply asked again the ordinary way. The script
names the season and the weeks as `currentSeason()` and
`weekScoreboardUrl()` do, and a test holds it to both.

Logos are not fetched through it: `Team.logo` is ESPN's CDN URL and
`TeamLogo` loads it directly, at the size it is drawn.

### Loading and failure

A page renders `Loading` until the teams and every week have arrived, and
`LoadFailed` with a retry if any of them cannot be read after Query's one
retry. "Try again" resets only the queries that failed; what arrived is kept. Both are the same frame: the header every page shares (the site's
mark, About) and, centred beneath, the mark breathing while the season is on
the way, or the failure. No grey bars stand in for content. Nothing about a
season is drawn until all of it is there, so a half-loaded page can never
show a result out of order.

When the season arrives, the header stays where it was and the page's body
comes in whole: `useRevealed()` holds it unseen until the marks in it have
decoded (giving up after 400 ms, so a slow logo never holds the season) and
fades it in. A mark that lands later fades into its box on its own
(`TeamLogo`), rather than popping. Nothing else is animated in.

The mark says "Still waiting on ESPN" after a few seconds, and either view
says so when the browser is offline (`useOnline`, Query's `onlineManager`,
told the browser's state on start so a page opened offline waits and loads
on its own). A failed week is named (`WeekLoadError`), and the cause is put
in the viewer's terms by `describeFailure()`: the browser's bare "Failed to
fetch" (a refused connection, or a 403 with no CORS headers) and "signal
timed out" are never shown as they are.

### Header

Every page shares `SiteHeader`: the site's mark (the possession football, as
in the favicon) and name on the left, linking home; at the right, in the same
place on every page, where the viewer is caught up to and, on the league
page only, a circled i to `/about` (`AboutLink`), the same size. A team
page's `AppHeader` adds the team's logo, name, record, and a favorite star;
below `sm` the team takes a row of its own beneath the mark and controls.
There is no team switcher; teams are picked from the standings.

### About page

`/about` (`About`, `src/components/layout/About.tsx`) says in a few lines
what the site is, that it is independent of the NFL and ESPN, and links to the repository
(`REPO_URL`) under the GitHub mark, as quietly as a recap link. Beside it,
`ContactLink` gives the site's email: the address is kept in two halves
(`CONTACT_USER`, `CONTACT_HOST`) and joined only after hydration, so the
prerendered HTML reads "Email" with no `href` and carries no address for a
harvester to lift. It holds no season data. A page of its own, so it can be
linked, it still opens and closes like a panel: its one header control is a
close (X) where the league page's About control sits, and it or Escape
returns to the league with `router.replace`, so the browser's back never
lands on About again. Keep it brief.

### Home page

`/` shows the week's games (under a week chooser) beside the standings, or
beside the bracket when the week is a playoff round. Below `lg` there is room
for one: a two-way switch under the header, Schedule or Standings
(Bracket in a playoff round), shows one or the other (`PaneSwitch`), never
both stacked. There the page is exactly the viewport and does not scroll:
the header and switch stay put and the pane shown scrolls beneath them.
Section headings are screen-reader only.
The chooser lists the regular season's weeks on one line (two rows of nine
below `sm`) and, beneath, each playoff round once its games are known. The
weeks share the line's width, so neither line ever scrolls.

The standings are laid out NFC and AFC side by side, North, East, South, West
down each; a row links to the team on the week the schedule shows (a bye week
included), and shows each team's record, ESPN's seed inside the field and its
clinch code (no Pct or streak). The table stays in view beside a long week.

The schedule says who plays when; the bracket (`buildBracket()`,
`src/lib/playoffs.ts`) shows how the postseason flows. Each conference is a
tree read left to right — Wild Card (the top seed's bye as a card of its own),
Divisional, Conference — NFC above AFC, joined by lines into the Super Bowl.
Every card is two lines, so a round's cards centre on their feeders and the
lines are plain borders. Once a game is seen, its winner's line is drawn solid
and its loser fades; a bye's line is always solid. A matchup not yet set is an
empty card.

The NFL reseeds after the Wild Card round, so which game fills which
Divisional slot is known only from the results (`divisionalFeeders()`). Until
the Divisional round is set and visible, the Wild Card column is listed by
seed with no lines into the next round, rather than drawn as a pairing that
may be wrong. Narrower than the tree, the bracket scrolls sideways
within itself, never vertically.

Hovering or focusing a game highlights its teams in the standings, and
hovering a team highlights its game. The schedule opens on the current week —
the one holding the next game ESPN has not settled — and the chooser changes
weeks in place, not by route. The shown week's scores and clocks come from its
own `WeekBoard`. Each side of a game links to that team's page on the game's
week (`/team/MIN?week=5`).

### Favorite team

No team is followed by default. The star on a team page sets the favorite in
`localStorage` (`src/lib/favorite.ts`, `useFavorite`); starring another
replaces it. The home page tints the favorite's game and standings row,
nothing more. The star is drawn like the possession football — muted, filled
when on.

### Team page

`ScheduleSelector` on the left drives `GameDetail` on the right, both drawn
directly on the page (no cards) with a hairline between. Each schedule row is
one line — week (or round), opponent, date, result — with playoff games after
the regular season, and the selection is marked with a rule at the row's edge,
not a fill. There are no tabs and no archive view; a
final game's panel links to its recap from its top row.

Below `md` the game has the page to itself and the schedule is a menu
(`ScheduleSwitcher`): a bar above the panel names the selected game and opens
the same `ScheduleSelector` as a sheet from the bottom; picking a game closes
it. The game and the schedule are never on screen together on a phone. The
site's mark in the header gains a chevron there, reading as the way back.

`GameDetail` branches on `gamePhase()` of the **selected** game:

| Phase  | Shows                                    |
| ------ | ---------------------------------------- |
| `live` | Score row, clock, data age, field, plays |

The data age is a readout, not a control.
| `final` | Score row, field, plays; recap icon in the top row |
| `pregame` | Countdown, kickoff details |
| `upcoming` | When and on what, and nothing else |
| `postponed`/`canceled` | The status and the original details |

Live and final panels lead with `ScoreRow`: away left, home right, matching
the field's end zones. It names the teams, so there is no separate matchup
header; teams stay visible while scores are masked. Between the scores sits the
status ("Final", or quarter and clock) and, with spoilers shown, the quarter
grid (both drop below the scores when narrow). The grid has no totals. Once a
game is over, a caret marks the winning score, live games included as soon as
the scoreboard calls them; a tie gets none.

Every panel has a full-screen control in its top row that hides the header and
schedule, and on a live or final panel the bottom bar too; Escape or the same
control exits. A final game with a recap linked has a YouTube icon beside it.
The panel's inset (`Panel`) is as wide as those controls' hit areas, since the
column scrolls sideways if anything pokes past it.

Keep the upcoming-game panel minimal: no score placeholders or empty recap
slots. Every panel's details are one line, kickoff and network; the venue is
not shown.

A bye week is a row of the schedule like any other: picking it (or a `?week=`
naming it) shows the week and "Bye", and nothing else.

### Selection is derived

`pickedGameId` starts as the game `?week=` names, or null, meaning "use the
default". The selection is `pickedGameId ?? defaultGameId`, so an explicit
pick sticks as the default moves and no effect writes selection state. The
default is live, then imminent, then most recently played.

`TeamApp` keys `TeamView` by season and team so changing either resets the
selection.

### Field spots use ESPN's home-goal frame

Every spot ESPN reports — `situation.yardLine`, a drive's start, each play's
start and end — is **yards from the home team's goal line**: the home offense
counts up toward 100, the away offense down toward 0 (SF's own 26 arrives as
`74` when SEA is home). Do not use `yardsToEndzone`: it reads 0 on timeouts and
is wrong on kickoffs.

`src/lib/field.ts` owns the frame and `FieldView` converts only when drawing
(away end zone left, home right). A drive is `driveSpots`, oldest first and
ending at the ball; the scoreboard supplies only `[start, ball]`, and
`withDriveSpots()` fills in every snap from play-by-play.

### Feed and field

`GamePlays` connects them. Selecting a play puts it on the field via
`fieldAtPlay()`: the line of scrimmage and line to gain, its set of downs so
far, and the snap itself as the last bar. `FieldView` draws the ball at the end
of the last bar. With nothing selected, a live field follows the scoreboard and
a finished one stays empty.

The feed is newest first whatever the game's state — live, finished, running
or paused — since the newest play is always the viewer's place, and a feed
that re-sorted on pause or at the final play would lose it. A quarter's rule
sits beneath its drives (`drivesByQuarter()`). The drive holding the play on
the field is open, or the newest with nothing on it; the rest fold, and
toggle by hand.

Replay steps through the game a frame at a time, manually or automatically.
Each snap is two frames: lined up (ball on the line of scrimmage, down and
distance only), then the result, animated as the bar grows and the ball moves
to where the play ended. The set of downs stacks from the top so each bar keeps
its place. Kicks and stoppages have only a result frame. There is one mode:
whatever is on the field, picked or paused on, can be stepped from, and play
runs on from it. With a play on the field, the controls — a drive back or
on, step, play/pause, speed — sit between field and feed; the arrow keys
step as they do, and shifted skip a drive. A drive on lands on its last
play's result (`skipIndex()`), the next drive's from there; a drive back
lands on the drive before's end, so the field stands as this one began.
Either way a running replay runs on from there. At the end of a finished
game the play control reads **Watch again**. With
nothing on it, the panel offers **Watch from kickoff** (or **Resume**). A
hidden live region announces the play on the field. Caught up with a live
game (`isLive()`), there is no speed to choose: what arrives after a replay
started plays at 1×.

While running, the feed holds back each play until its result frame
(`drivesThrough()` also hides the cut drive's result); paused, it is the feed
as browsed. With a play on the field the score row shows the state
at that point: possession, timeouts left in the half (`timeoutsLeft()`), and
the quarter grid so far (`pointsByPeriod()`); picking it again clears it. The last
play of a finished game reads "Final" with the winner marked. ESPN names the
team that called a timeout only in its text, by gamebook code ("BLT" for
Baltimore); `GAMEBOOK_CODES` maps those.

A running replay stores its start frame and time, and `useReplay` derives its
position from the shared clock rather than a timer, re-rendering only when the
frame changes. Speed shortens only the pause between plays, never the
animation: a result holds for the draw (doubled for punts and kickoffs) plus a
rest divided by the speed. The three times — lined up, draw, hold — live in
`src/lib/replay-timing.ts`, and the field passes the draw to the stylesheet
as `--field-draw` so the animations keep step. In development only,
`?timing=lineUp,draw,hold` (milliseconds) overrides them for tuning by feel,
kept in the browser until `?timing=`; the build has no such setting. Replay
state carries the game id, so selecting another game resets it without an
effect.

### Play kinds

`extractPlayByPlay()` gives each play an `action` — run, pass, punt, kickoff
or field goal — from ESPN's play type. A penalty or fumble recovery names only
its result, so the text decides. It also gives an `outcome` — touchdown, field
goal, no good, safety, punt, interception, fumble — for plays that end a
possession or score. ESPN leaves some turnovers unflagged (a muffed kickoff the
kicking team recovers), but capitalizes a change of possession in the text:
"RECOVERED by", "INTERCEPTED". `FULL_GAME`
(`src/lib/test-utils/espn-summaries.ts`) is a synthetic game covering every
kind of drive end, and a test requires every drive's result to be explained by
one of its plays.

On the field a run is a solid bar and a pass an open one, so colour stays for
gain, loss and penalty. Punts, kickoffs and field goal tries are arcs, not bars
(a 50-yard punt bar reads as a 50-yard gain). A returned kick is an arc to
where it landed, then the return as a bar. ESPN reports only where the play
ended, so the landing comes from the distance in the text ("punts 56 yards"); a
fair catch or downed ball has no return, and a touchback is placed, not run
back. A score highlights the end zone. The feed tags a play's outcome in one
word; runs and passes are untagged.

ESPN's summary has no short description per play, so `playHeadline()` builds
one like ESPN's own feed: "7-yd Run", "Incompletion", "10-yd Sack", "56-yd
Punt", "False Start". A stoppage's is in the feed's own words ("End of 1st
Quarter", "Halftime"), not ESPN's "END QUARTER 1", and a timeout's is its
text, which says who and when; the feed and the caption show it. The yards are what the play gained per its text ("for 13
yards"), not ESPN's net, so a run nullified by holding still reads "13-yd Run",
tagged with the penalty. Anything else falls back to ESPN's type name, and a
test requires that no play in the corpus does.

### Team and week come from the URL

The league is at `/`, a team at `/team/MIN` (optionally `?week=5`, or
`?week=wild-card` for a playoff round). `src/lib/routes.ts` builds every such
link. The export names every team page up front (`TEAM_ABBREVIATIONS`,
`generateStaticParams`), and an abbreviation ESPN does not know falls back to
the standings.

---

## Recaps come from the recap dataset

The app never searches YouTube. Which video is a game's recap is decided by
[football-recaps-data](https://github.com/dfrancour/quiet-football-recap-data),
which holds one JSON file per season and the tool that builds it: the
matching rules, their corpus of real titles, and the corrections a person
made. A wrong or missing recap is fixed there, not here.

`recapDatasetQuery` reads the season's file from the dataset's repository
(`<url>/<season>.json`, `src/lib/recap-dataset.ts`), once a visit. `recapsFromDataset()` keys each `found` game by the game in the
same week between the same two teams, whichever is home. The dataset numbers
the postseason as the app does (Wild Card is week 19 of an 18-week season),
so playoff games join the same way; keep the two in step. Preseason games,
which the app does not hold, are skipped. A season the dataset does not have
yet simply has no recaps.

The dataset's reader is loose (only the fields used), so a field the dataset
adds never breaks it. It records titles verbatim, spoilers included; the app
never shows one.

A final game's panel carries `RecapLink` in its top row, beside the
full-screen control: a YouTube icon, out to YouTube since the NFL blocks
embedding, drawn only once the dataset has linked a recap. Until then there is
nothing, not a search. The NFL posts a recap soon after a game and the
dataset is updated often, so while the selected game is final and still
unlinked `useRecaps` re-reads the file on a schedule that backs off from
when the game went final (`recapsPollMs`, from `scoreConfig.recapsPoll`):
every five minutes for the first hours (GitHub caches the file for five),
every half hour through the first day, every two hours to three days, then
never. When it went final is the moment a scoreboard poll first saw it
complete (`gameSettledAt`, `game-clocks.ts`); a game already over when
first seen is taken to have ended a typical game after kickoff
(`typicalGameMs`). A game under way, one from weeks ago, or the offseason
asks nothing.

## Other invariants

### Spoilers are hidden by default

There is no switch for spoilers. The viewer is **caught up through** a week
of each season (0 to start, so hidden is the default), and everything through
that week is shown: its scores, records and standings. Past it, nothing may
reveal a result the viewer has not watched or uncovered. This covers more
than scores:

- the W/L letter: `resultVisibility()` collapses a played game to `"Final"`
- records: a team's is counted only through the week caught up through, and
  the records going into a game show only once every week before it does
  (`recordsShownBefore()`)
- the standings: built from the weeks caught up through only; caught up
  through none, every figure is masked and divisions are listed
  alphabetically, since order reveals results. ESPN's seeds and clinch codes
  describe the present, so they show only once caught up through the regular
  season
- playoff matchups: see below
- **emphasis**: `ScoreLine`'s `leading` prop must stay false while scores are
  hidden
- YouTube thumbnails often show the score, and titles can give the result
  away ("The 28-3 Comeback"), so `RecapLink` renders neither
- overtime: with results hidden, `spoilerSafeClock()` reads a live game as
  "Q4+" from the start of the fourth quarter (so nothing changes when
  regulation ends) and "Final", not "Final/OT", once over
- live game state — situation strip, ball marker, timeouts

A hidden figure is drawn by `Redacted`: a covered bar about the figure's width,
never a glyph that could pass for a value. Mask functions return `null` for
hidden and leave drawing to it.

Always visible: kickoff dates, team logos, and whether a game is `Final` or
`LIVE`. Every schedule row shows its date; only the result column reacts to
being caught up.

The header names the week (`CaughtUp`: "Through Week 7") over a strip of the
season's weeks, a popover from `sm` up and below it a sheet (`Sheet`, shared
with the team page's schedule) with the weeks in rows of nine so each is a
fingertip wide, closing on a pick: any week up to `settledThrough()` (the last week with every game in
it and before it final or canceled, so a week still being played is never
offered), or none, which hides everything again: it also drops every game's
place (`clearWatchProgress()`), so a game watched in part or seen to the
end is covered again. The week is **stored, not relative**: when the league
moves on, the viewer stays where they were. The home page opens on the week
after it, if the league is past that.

The week in progress is offered too, once a game in it is over
(`weekInProgress()`, `src/lib/week.ts`): half a cell, split corner to corner,
named "Week 7 so far". Picking it catches up through every settled week and
marks that week's finished games **seen to the end** (`finishGames()`), the
same place a watched game reaches, so nothing new is stored: a game that
ends later stays covered, the cell is hatched again until picked, and the
record and standings still stop at the week caught up through. The games
stay seen if the viewer goes back, as any game seen to the end does.

It is kept per season in `localStorage` (`catchUpThrough()` in
`src/lib/spoilers.ts`, read by `useSpoilers`); changing it recomputes the
page in place. Everything else the viewer chose is keyed by game id. It names
only weeks the viewer said they were done with, so it does not expire.

A first visit lands on a page of covered results that says nothing about
why, so the strip opens by itself once the season is in, its status line
reading "Pick the last week you've seen"; closing it or picking a week ends
that for good (`spoilers-introduced`, `src/lib/first-run.ts`, not per
season). A viewer already caught up through a week has found the control
and is not shown it. That is the one line of guidance the site has: no
tour, and nothing added to the page body. With nothing caught up the
control is the brighter of its two states, so it reads as the way in.

Masking is a matter of what is drawn, not what is fetched: the browser holds
the whole season so uncovering a game needs no request, and anyone can read
ESPN's answers in the network panel. That is accepted; they are public
anyway.

### Playoff matchups are covered round by round

A playoff matchup gives away the round before it: a Divisional game says who
won on Wild Card weekend, and the Wild Card field how the regular season
ended. So each playoff game carries a `gate` (`matchupGates()`): Week 18 in its
conference for a Wild Card game, the round before in its conference after
that, both Conference Championships for the Super Bowl, each with those
games' own gates, since a matchup gives away every round before it. Until
every game in the gate is shown — caught up through, or seen to the end
(`isShown`, `isOpen` from `useSpoilers`) — the matchup is covered.
Caught up through a round, the next one's matchups show:

- the week view and bracket draw both teams with `CoveredTeam` and link,
  highlight and tint nothing (the favorite's tint would name a team)
- the bracket covers the top seed's bye with the Wild Card round
- a team page leaves the game out of its schedule altogether, since a row
  says the team got there, and never opens on it, whatever the URL says

### Watching a game: one place per game

Past the week caught up through, a game is shown up to the viewer's **place**
in it: the furthest play whose result they have seen (`src/lib/watch-progress.ts`,
stored in the browser). Watching a replay, following live and uncovering are
all ways of moving it; nothing past it is shown. Once the place reaches the
end of a game that is over, the game is **seen to the end** (`finished`), and
`isShown` treats it like a week caught up through: panel, schedule rows and
playoff gates show its result. The record and standings still stop at the
week caught up through.

- the place only moves forward. A play once seen cannot be unseen, so
  stepping back, pausing early or watching again from kickoff leaves it
  where it was, and a game seen to the end stays so. Only **Hide all** in
  the spoilers control clears it, for every game at once. A snap paused
  while still lined up was never played, so the play before it is the place
- before any of it is watched, the panel offers **Watch from kickoff** in
  place of the feed, over an empty field and masked score; the plays are
  not even fetched until then
- partway through, the score row, field and feed stand at the place, the feed
  newest first, with **Resume** leading; picking plays and stepping back
  browse what was seen without moving the place, the feed and score row
  standing at the play on the field, and stepping forward past it is
  watching
- the place never stands in for how far along the game is. A schedule row
  shows the game's own state — its clock while live, Final once over — and
  its result once seen to the end. While the score row stands at a play, the
  panel's top line adds the game's own state beside it ("Live · Q4+",
  "Final"), under the same overtime rule as everywhere

Watching live is being at the newest play. A replay that reaches the end of a
game under way holds there and plays each new snap out as it arrives
(`play-arrivals.ts` notes when each one did), so the place follows the game.
Pausing or leaving stops it there; **Resume** replays from the place, at any
speed, and on reaching the newest play is live again. Followed to the final
play, the game is seen to the end.

The panel's eyebrow label skips ahead: while the result is hidden, a live
game's **Live** label joins at the newest play, and a finished game's
**Final** label sees the game to the end (`finishGame()`). The same label
in the same place, whether the score is covered or the row stands at a play.
Tapping a covered score does the same. Add no button and no explanatory
text for any of these: with a pointer the hover state is the only hint, and
nothing is spelled out for a finger. A recap is watched outside the app and
moves nothing.

The place reveals nothing unseen, so it does not expire.

### Broadcast delay

A viewer following a game on the radio or TV, which runs behind the data,
can hold that game back. Caught up with it, the speed control's place holds
the delay instead: "+0s", cycling 0, 10, 20, 30, 45 and 60 seconds, the
tooltip naming the next ("Add 10s delay"). It is kept per game in the
browser (`src/lib/broadcast-delay.ts`).

Everything about the game waits for it, so nothing is known before the
broadcast tells it:

- each play is available its delay after it arrived (`useBroadcastDrives`),
  and the replay paces from then. A game's first load counts as long
  arrived, so setting a delay holds back only what comes next; nothing
  already seen is held back again, so lengthening it only waits
- the game's own clock, on schedule rows and beside the score row, is the
  one from the delay ago (`game-clocks.ts` keeps each game's from the
  scoreboard polls for a couple of minutes)
- a game ESPN calls final still reads as live until that delayed clock
  reaches the end (`broadcastPhase()`), so neither the panel nor a row says
  Final first

### Dates render in a named time zone

Kickoff dates and times go through `src/lib/dates.ts`, which formats for the
zone it is given in `en-US`, never the host's. The prerendered markup uses
the league's zone (Eastern), and `useTimeZone()` keeps it through hydration,
then switches to the viewer's, so the build machine's zone never reaches a
page or mismatches the markup.

### One shared clock

All time-dependent UI reads `useNow()`, backed by one module-level interval in
`src/lib/clock.ts`. It returns `null` until mounted so SSR output is stable. Do
not add component-local `setInterval` clocks.

The clock ticks once a second. A subscriber can request a finer interval (a
running replay uses 100ms); the interval speeds up only while such a subscriber
exists, and other subscribers are still notified once a second.

### Layout

On a team page from `md` up, the page is exactly the viewport and does not
scroll: the header is fixed, and the schedule rail and detail panel scroll
independently, with the selected week kept in view. Below `md` the page
scrolls normally and the field and its transport stick to the top, so a
replay can be followed from anywhere in the feed.

The site is meant to be installed on a phone, so it is laid out for touch:
every control has at least about 36px to tap (padding past the glyph, not a
bigger glyph), controls set `touch-action: manipulation` so quick repeated
taps never zoom, nothing depends on hover or a `title` tooltip for meaning,
and the root `main` pads by the safe-area insets so an installed page is not
under the notch or home indicator.

### Dark-only; logos from ESPN's CDN

No theme toggle. Only the dark logo variant is used (`pickLogoHref`).

Logos are **not committed** (they are the NFL's artwork) and not copied: a
public site redistributing them would be worse than linking them. `Team.logo`
is ESPN's CDN URL, and a team ESPN has no logo for reads as `logo: null`.

ESPN ships a true dark logo for only ten teams, so `TeamLogo` adds a thin light
halo under every one; otherwise dark logos (e.g. Carolina's) disappear against
the background.

Render logos through `TeamLogo`, not `<img>`: it reserves the box for a team
with no logo so rows do not shift, and keeps the logo decorative unless
`labelled` is passed. It asks ESPN's resizer (`logoAt()`) for a 96px copy of
the mark, one file per team shared by every box and page: the originals are
500px (Green Bay's 4096), a couple of megabytes for a page that draws them
at 20px, and the CDN caches them for minutes where it keeps the small ones
for a day.

### Analytics and discoverability

`VercelAnalytics` (in the root layout) mounts Vercel Analytics and Speed
Insights, Vercel's anonymous page views and load times. There is no opt-out
and nothing else is collected.

`src/lib/site.ts` holds the site's name, URL and description. The root
layout sets `metadataBase`, a title template and Open Graph tags from it,
with `public/og.png` (the site's mark, rendered from `icon.svg`) as the card;
`robots.ts` and `sitemap.ts` (the home page and every team page) are
metadata routes, prerendered like everything else. Each team page
titles itself by abbreviation. Keep copy terse.

The site is installable: `manifest.ts` is a metadata route too, and its
icons (`public/icon-*.png`, plus `app/apple-icon.png` for iOS) are the mark
from `icon.svg` on the site's background, rendered with sharp; the maskable
one keeps the mark inside the safe zone. There is no service worker: nothing
works offline, since every page reads ESPN.

### Static export

`next.config.js` sets `output: "export"` and `images.unoptimized`. There is
no server code: no route handlers, server actions, middleware or
`next/headers`. A page component only renders a client component. Anything
that needs the URL's query string reads it with `useSearchParams` under a
`Suspense` boundary.

---

## Repository Rules

### Pre-Commit Validation

- No job is finished until you have run `pnpm run pre-push`
- This runs: format check -> lint -> typecheck -> test -> **build**

### Code Quality

- **NEVER use TypeScript `any`** -- `unknown` with Zod validation at the boundary
- NEVER add version suffixes to names (`processV2`, `handleNew`, `ClientOld`)
- NEVER add historical comments -- code describes current state, git shows history
- NEVER skip tests for complex business logic
- Shared test fixtures live in `src/lib/test-utils/fixtures.ts` and use real
  ESPN team ids. Fixtures are written by hand: never commit a captured ESPN or
  YouTube payload
- A hook that reads a query is tested under `queryWrapper()` with `stubFetch()`
  (`src/lib/test-utils/query.tsx`); no test reaches the network

### React

- `react-hooks/refs` and `react-hooks/set-state-in-effect` are errors. Do not
  return a `RefObject` from a hook (pass one in instead), and do not call
  `setState` synchronously in an effect body — subscribe to an external store or
  fire from a callback.

### Dependencies

- Versions are **pinned exactly**. `minimumReleaseAge` (7 days) rejects
  freshly published packages.
- `pnpm-workspace.yaml` holds the supply-chain settings, including the
  `allowBuilds` allowlist for packages needing build scripts.
- There are no settings and no runtime environment: every URL the app reads
  is a constant.

---

## Commands

```bash
pnpm dev                    # local dev server
pnpm run pre-push           # REQUIRED before commit
pnpm run check              # lint + typecheck + tests
pnpm build                  # the static site, in out/
```

There are no data commands: the browser fetches everything.
