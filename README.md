# Quiet Football

An NFL season browser with no ads, no betting lines, and no result shown until
you ask for it. A static site that reads ESPN from your browser.

Pick a week and the page shows what that game warrants: play-by-play and a
recap link once it is played, the score and plays while it is on, or the
kickoff time if it has not started.

## Requirements

- Node 24+
- pnpm 11+
- An internet connection

## Quick start

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

The repository carries no data and the site has no server: each page fetches
the teams and the current season from ESPN's public endpoints when it opens,
and polls a week again only while a game in it is under way. Nothing is kept
between visits except your own choices (the week you are caught up through,
your favorite team, how far you watched each game), in your browser.

## What it does

The home page shows the week's games beside the standings. Hovering a game
highlights its teams in the standings, and vice versa. Starring a team on its
page makes it your favorite, which the home page highlights.

A team page lists the schedule on the left and the selected game on the right,
opening on the live game, then the next one, then the last one played.

Team and week are in the URL: `/team/MIN?week=5`, with `?week=wild-card` for
a playoff round. Only the current season is shown.

- **Played game:** score, field, every play, and a link to the NFL's recap on
  YouTube, usually within half an hour of the final whistle, or a YouTube
  search until it is posted.
- **Live game:** score, clock, field and play-by-play.
- **Future game:** kickoff time, countdown, broadcast and venue.

In the postseason the week chooser adds each round as it is set (`WC`, `DIV`,
`CONF`, `SB`), and a playoff week shows the bracket beside its games. The
standings carry ESPN's playoff seeds and clinch marks (`x`, `y`, `z`, `e`).

### Spoiler-free by default

Results are hidden until you turn spoilers on: scores, W/L, the season record,
the standings (listed alphabetically, since the order gives results away),
which team is emphasized, and overtime. Recap links show no thumbnail or
title, since either can give the result away.

Tap a covered score to uncover just that game.

**Watch from kickoff** replays a hidden game play by play and remembers how far
you got, showing everything up to there and nothing past it.

A playoff matchup stays covered until you have seen the round before it (Week
18 for the Wild Card round), since who is playing gives earlier results away.
Your team's page lists a playoff game only once you could know it is there.

Kickoff dates and whether a game is `Final` are always shown.

You catch up through a week, never on; the league moving on reveals nothing
until you say so.

### Keyboard

| Key     | Action                          |
| ------- | ------------------------------- |
| `←` `→` | Step back / on through the game |
| `Esc`   | Leave full screen               |

## Recaps

Recap links come from
[football-recaps-data](https://github.com/dfrancour/quiet-football-recap-data),
a public dataset of every game's recap on the NFL's YouTube channel, kept
current within minutes of each video being posted. The browser reads it
while a recent game is still waiting on its recap; no API key or account is
needed.

## Deploying

`pnpm build` writes the whole site to `out/`. Any static host serves it;
on Vercel, import the repository and it is detected as a Next.js static
export. There is nothing to configure and nothing to run.

## Scripts

```bash
pnpm dev                 # dev server
pnpm run pre-push        # format check, lint, typecheck, tests, build
pnpm run check           # lint, typecheck, tests
pnpm test                # vitest watch
pnpm build               # the static site, in out/
```

## Stack

Next.js 16 (static export) · React 19 · TanStack Query · TypeScript (strict) ·
Tailwind 4 · Zod · Vitest

## License

[MIT](LICENSE), for the code. Not affiliated with the NFL, ESPN or YouTube.
Schedules, scores and play-by-play come from ESPN's public endpoints, read by
your browser; team logos are shown from ESPN's CDN and recaps belong to their
owners. None of it is in this repository.
