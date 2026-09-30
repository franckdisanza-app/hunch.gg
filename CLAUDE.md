@AGENTS.md

# Plimp

Small daily browser games under one link (plimp.lol). Each game asks for a gut guess about
something true, then reveals the sourced answer with "Turns out…". A daily round takes 2–5 minutes
on a phone; every daily game also has an unlimited mode that never touches streaks or stats. Web
only, mobile first. No accounts, no ads, no cookies. Each game is its own visual world inside one
Plimp frame that never changes.

Keep this file short and current. Details live in `docs/`.

## Commands

| Command                                                                         | What it does                                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                                                      | Dev server. Hidden games and `/dev` (component gallery) work here.                               |
| `pnpm build`                                                                    | `content:validate`, then `next build`. A validation error stops the build.                       |
| `pnpm lint` / `pnpm format`                                                     | ESLint (zero warnings) and Prettier check / write.                                               |
| `pnpm typecheck`                                                                | `next typegen` + `tsc`. If it trips on a deleted route in `.next/dev/types`, delete `.next/dev`. |
| `pnpm test`                                                                     | Vitest: unit, component, API route and SQL (migrations run in PGlite) tests.                     |
| `pnpm test:e2e`                                                                 | Playwright + axe against a production build (builds first; `E2E_SKIP_BUILD=1` reuses one).       |
| `pnpm size`                                                                     | First-load JS budget, after a build with `ENABLE_DEV_ROUTES=1`.                                  |
| `pnpm content:validate`                                                         | Schemas, sources, 14/30-day lookahead, no `sample: true` in production.                          |
| `pnpm new-game <slug> --name "<Name>" --engine <choice\|estimate\|clue\|map>`   | Scaffold a hidden game.                                                                          |
| `pnpm csv-to-json <game> <file.csv>`                                            | Spreadsheet export → content, via `content/<game>/csv-mapping.json`.                             |
| `pnpm db:start` / `db:reset` / `db:types`                                       | Local Supabase (needs Docker), reset with seed, regenerate types.                                |
| `pnpm sticker-shock:build` (and `:proofs`, `:open-prices`, `:accuracy`, `:art`) | Sticker Shock's data pipeline: `docs/games/sticker-shock/`.                                      |
| `pnpm ping:build` (and `:sample`, `:art`, `:furthest`, `:difficulty`)           | Ping's dailies and tools: `docs/games/ping/` (content guide included).                           |

Local crowd API without Docker: `CROWD_STORE=memory` in `.env.local`.

## Map

```
src/app/            routes: shelf, about, privacy, dev/, (games)/<slug>/, api/
src/frame/          the shared chrome: GameShell, TopBar, sheets, ResultsScreen, RevealCard, ui/;
                    game plumbing: useJson (+ early prefetch), prefs, game-route
src/games/          types.ts (GameDefinition), registry.ts, content.ts, <slug>/ per game
src/engines/        shared game mechanics: choice/ (Sticker Shock; next Tiptoe, Coined, Chimp),
                    map/ (Ping; next Souvenir)
src/lib/            daily, storage, share, sound, format, analytics/, crowd/, content/, supabase/
src/styles/         tokens.css (frame tokens, light/dark)
content/<slug>/     daily/0001.json … (read at request time, never imported)
supabase/           config.toml, migrations/, seed.sql (fake data only)
scripts/            new-game, validate-content, csv-to-json, check-bundle-size
tests/              e2e/ (Playwright), unit/ (setup, SQL tests)
docs/               ARCHITECTURE, ADDING_A_GAME, DEPLOY, games/<slug>.md
```

## House rules

| Element   | Shared frame (all games)                                                                            | Each game's world                               |
| --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Layout    | top bar with the Plimp wordmark, back to the shelf, help, stats, settings; results screen structure | background, illustrations, animations           |
| Type      | Inter for interface text                                                                            | one or two display fonts                        |
| Colour    | neutral greys and one focus colour                                                                  | a 4–5 colour palette plus a dark variant        |
| Reveal    | the "Turns out…" card layout and its source line                                                    | card artwork and the signature reveal animation |
| Share     | the text format                                                                                     | the share image                                 |
| Character | none: Plimp itself has no mascot                                                                    | one mascot with six poses                       |
| Sound     | off by default, one toggle                                                                          | two or three signature sounds                   |

## Conventions

- **Nothing is made up.** No invented facts, prices, dates or sources, not even in examples or
  tests. Placeholders are obviously fake (`example.test`, "Fake …", `sample: true`). Every fact has
  `sourceTitle`, `sourceUrl`, `checkedOn` and `licence`; every reveal shows its source line.
- **Games are plugins.** A game is a registry entry + `src/games/<slug>/` + `src/app/(games)/<slug>/`
  - `content/<slug>/`. Adding a game never touches another game. ESLint enforces: no game imports
    another game (code, pages or API routes), `src/frame` imports no game code, nothing in `src/`
    imports `content/`. Game-specific endpoints live under `src/app/api/games/<slug>/`. See
    `docs/ADDING_A_GAME.md`.
- **Engines** own rules and state (rounds, answers, scoring); games own content, art, strings,
  sounds and the reveal. Engines never import from a game. The **choice engine**
  (`src/engines/choice/`): rounds of 2–3 options and a game-supplied `correctIndex`; `startChoice`
  / `pickOption` / `nextRound` are pure (daily `list` or unlimited `generator` with
  `endOnMiss`, resumable answers); `useChoiceGame` adds keys (A/←, B/→, C, Enter), focus (Next
  after a reveal), `revealDelayMs` (0 under reduced motion) and `onPick`/`onReveal`/`onFinish`;
  `ChoiceBoard` renders real buttons through `renderOption`/`renderReveal` slots, an optional
  pinned `actionBar` for Next, and a live region; `summarize` gives score, streak and the emoji grid. No strings in the engine.
  The **map engine** (`src/engines/map/`): rounds of up to `weights.length` pins against one or
  more targets (a pin scores against the nearest); scoring relative to the round's scope size
  (`scopeSizeKm`): a pin inside the perfect radius scores `maxPoints` on any attempt, a miss
  `maxPoints · e^(−d / (decay × scope))` × its attempt weight, bands by fraction of the scope;
  `startMap` / `dropPin` / `nextRound` are pure and resumable (`saveMap`); `useMapGame` adds
  callbacks and focus. `Globe` (lazy-load it: d3-geo + world-atlas never reach the shelf) is an
  orthographic canvas globe with a fixed crosshair, drag with inertia, pinch, wheel, arrows,
  +/− and Enter, rings, pins, target blips, arcs, a radar sweep and `flyTo`; colours may be
  `var(--game-…)`; screen readers hear the coordinates and country under the crosshair; jump
  cuts under reduced motion; a `backdrop` picture of the opening view spares the first draw, and
  the 1:50m shapes wait for the player's first move. `geo.ts`: great-circle distance, geodesic circles, circle
  crossings, antimeridian-safe boxes, km/mi. `/dev/globe` shows it with a fake target.
- **Schemas:** Zod everywhere (content, API payloads, stored state), always `zod/mini`
  (`import * as z from "zod/mini"`). Classic `zod` is banned by lint: it adds ~90 KB gzipped to any
  browser bundle it touches.
- **Strings:** every user-facing string lives in a strings module: `src/frame/strings.ts` (frame),
  `src/frame/site-strings.ts` (server-only page copy), `src/games/<slug>/strings.ts` (games).
  English now; German, French and Italian later. Format numbers, currencies and dates with
  `src/lib/format.ts`, which uses the fixed `UI_LOCALE`, never the browser's (hydration).
- **Accessibility:** WCAG 2.2 AA. 44 px touch targets, visible focus, `prefers-reduced-motion`
  honoured (motion tokens drop to 0 ms), game ink on bg ≥ 4.5:1 in light and dark (unit-tested).
  e2e runs axe on every page; zero serious or critical violations.
- **Analytics** (`src/lib/analytics/`): only these typed events: `game_start`, `game_complete`,
  `share_click`, `share_arrival`, `return_day`, `poll_vote`, `report_sent`. Props are identifiers
  and numbers; never the device ID or free text (`track()` also strips them).
- **Storage** (`src/lib/storage.ts`), all validated on read, corrupt keys reset alone:

  | Key                         | Holds                                                                                |
  | --------------------------- | ------------------------------------------------------------------------------------ |
  | `plimp:v1:meta`             | device ID, first visit, theme, sound, game prefs, how-to seen, return-day milestones |
  | `plimp:v1:<game>:stats`     | played, completed, streaks, last completed/played puzzle, score histogram            |
  | `plimp:v1:<game>:history`   | per puzzle number: answers, score, start and finish time                             |
  | `plimp:v1:<game>:unlimited` | best run, runs played                                                                |
  | `plimp:v1:<game>:polls`     | option picked per one-tap poll                                                       |

- **Daily rotation:** puzzle number = local calendar days since `launchDate` + 1; the puzzle API
  serves `n` only when `n` ≤ today's number in UTC+14. Crowd data is keyed by puzzle number.
- **Performance:** first-load JS ≤ 185 KB gzipped for `/` and an empty GameShell (framework alone
  ~136 KB). Lazy-load anything not needed for first paint (see `src/frame/lazy.ts`). Lighthouse
  mobile ≥ 90 for performance and accessibility on `/`.
- **Security:** static pages, so the CSP allows inline scripts (Next's hydration data) and is strict
  otherwise. New third-party hosts go through `src/lib/security/headers.ts`. The Supabase client is
  `server-only`; the browser only talks to our `/api` routes.
- **Next.js 16:** read `node_modules/next/dist/docs/` before using an API. `proxy.ts` replaced
  middleware, route params are Promises, `typedRoutes` is on, Turbopack builds.
- Ask before adding a paid service, anything that sets cookies, or a heavy dependency.

## Games

Sticker Shock is `live` on sample data with a placeholder `launchDate` (real prices and date to
come: `docs/games/sticker-shock/data-guide.md`). Ping is `hidden`, fully built on 20 fake sample
questions with a placeholder `launchDate` (real questions to come:
`docs/games/ping/content-guide.md`). The others are `hidden`, with no code or content.

| slug          | Name          | Engine   | Crowd                        | Tagline                                                        |
| ------------- | ------------- | -------- | ---------------------------- | -------------------------------------------------------------- |
| sticker-shock | Sticker Shock | choice   | polls, guesses (right/wrong) | Which costs more? Every price is real, with receipts.          |
| handshoe      | Handshoe      | clue     | –                            | Guess the thing from its literal name in another language.     |
| ping          | Ping          | map      | guesses (first-pin km)       | Pin the world's extremes: hottest, wettest, farthest.          |
| souvenir      | Souvenir      | map      | –                            | Where does this English word come from? Drop a pin.            |
| ja-nein       | Ja/Nein       | estimate | polls, guesses               | Vote on a real Swiss referendum, then guess the yes-share.     |
| same-boat     | Same Boat     | estimate | polls, guesses               | Pick a side, then guess how many players agree with you.       |
| fair-guess    | Fair Guess    | estimate | guesses                      | Guess the count in a photo, then see if the crowd beat you.    |
| tiptoe        | Tiptoe        | choice   | –                            | Which is worse for the climate?                                |
| chimp         | Chimp         | choice   | optional (decide when built) | Three answers about the world: can you beat a random chimp?    |
| coined        | Coined        | choice   | –                            | Which word is older?                                           |
| smudge        | Smudge        | clue     | –                            | Guess what thousands of people drew from their average doodle. |

To build one: `docs/ADDING_A_GAME.md`.
