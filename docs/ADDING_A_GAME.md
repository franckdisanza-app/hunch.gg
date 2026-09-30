# Adding a game

From `pnpm new-game` to `status: 'live'`. Work on a branch; every step keeps `pnpm lint`,
`pnpm typecheck`, `pnpm test` and `pnpm build` green.

## 1. Scaffold

```bash
pnpm new-game sticker-shock --name "Sticker Shock" --engine choice
```

- For a planned game (already in `src/games/registry.ts`) the registry entry is kept as is;
  otherwise a hidden entry is added. Nothing is ever overwritten.
- Created: `src/games/<slug>/` (strings, theme stub, mascot stub, content schema stub, placeholder
  component), `src/app/(games)/<slug>/` (daily page, unlimited page, OG image stub),
  `content/<slug>/daily/`, `docs/games/<slug>.md`.
- `pnpm dev`, then open `/<slug>`: hidden games work in development (and in builds with
  `ENABLE_DEV_ROUTES=1`), and build as 404 in production.

## 2. Design the world

- [ ] Fill in `docs/games/<slug>.md`: concept, sources and licences, world, sounds.
- [ ] Palette in `src/games/<slug>/theme.ts` (4–5 colours, light and dark). Ink on bg must reach
      4.5:1 in both; the contrast test checks it once the game is coming-soon or live.
- [ ] Display fonts: load them with `next/font` in the game's route files only, e.g.
      `const display = SomeFont({ subsets: ["latin"], variable: "--game-font-display" })`, and
      pass `className={display.variable}` to `GameShell`. The `font-display` utility then uses
      it inside the game world; game fonts never load on other routes.
- [ ] Wordmark: an SVG of the name in the display font in `public/games/<slug>/`, set as
      `theme.wordmark` (the shelf shows it instead of loading the font).
- [ ] Mascot: name it in `mascot.ts` and draw six poses (idle, thinking, correct, wrong,
      celebrate, point) in `public/games/<slug>/mascot/`.
- [ ] Sounds: two or three short ones, registered with `sound.register("<slug>:<name>", …)`.
- [ ] Share image: `src/app/(games)/<slug>/opengraph-image.tsx`.

## 3. Build the game

- [ ] Use or add the engine in `src/engines/<engine>/`. Engines own rules and state and are
      themed by the game; they never import from a game.
- [ ] Replace the placeholder component. Use `useGame()` for the puzzle number, player state
      (`start`, `saveProgress`, `complete`), `playSound` and `track`.
- [ ] Fetch the day's puzzle from `/api/puzzle/<slug>/<n>` once with `useJson` (`src/frame/`),
      passing `prefetchTodaysPuzzle("<slug>")` from module level so the request starts before
      hydration (`prefetchJson(url)` does the same for an unlimited pool); never import
      `content/`.
- [ ] Reveals use `RevealCard` ("Turns out…" + source line + report link); the end uses
      `ResultsScreen` and `buildShareText` (no answers in the share text; pass them as
      `spoilers`).
- [ ] Crowd features: set `usesCrowdApi` in the registry; poll IDs are `<slug>:<id>`; use
      `OneTapPoll`, `sendGuess` and `fetchCrowdStats`. Game-specific endpoints go under
      `src/app/api/games/<slug>/`.
- [ ] Game settings (e.g. display currency) go in `GameShell`'s `gameSettings` slot. Describe
      each as a `GamePref` and read or save it with `useGamePref` / `saveGamePref`
      (`src/frame/prefs.ts`); reuse an existing key (`currency`, `distanceUnit`) when it means
      the same thing.
- [ ] Scores in the hundreds or thousands: pass `scoreBucket` and `formatScore` to `GameShell`
      so the stats chart groups them (Ping groups by 500).
- [ ] Every string in `src/games/<slug>/strings.ts`; format with `src/lib/format.ts`.
- [ ] Keep first-load JS under budget: `ENABLE_DEV_ROUTES=1 pnpm build && pnpm size` measures
      the shelf, the empty shell and every game route (the game's pages are found on their own).
- [ ] Unit tests for scoring and content, e2e for a full daily round with axe.

## 4. Content

- [ ] Define the real schema in `content.schema.ts` with `factSchema` (`zod/mini`). Every fact
      needs `sourceTitle`, `sourceUrl`, `checkedOn`, `licence` (a `facts()` accessor can map
      other field names, as Sticker Shock does for prices). Files without facts leave `facts`
      out; rules across files go in `contentSpec.check`.
- [ ] Write content in `content/<slug>/daily/0001.json`, … or import a spreadsheet:
      `content/<slug>/csv-mapping.json` + `pnpm csv-to-json <slug> <file.csv>`.
- [ ] Nothing invented. Placeholder content is marked `"sample": true` and never ships.
- [ ] `pnpm content:validate` passes.

## 5. Go live

- [ ] Pick `launchDate` (the date of puzzle #1, in the player's own time zone).
- [ ] Registry entry: `status: 'coming-soon'` first if you want a greyed tile, then `'live'` with
      `launchDate`, `theme` and `mascot` (import them from the game folder). No `TODO` left in
      the name or tagline.
- [ ] At least 14 days of daily content from launch (30 to avoid warnings) and
      `CONTENT_MODE=production pnpm content:validate` passes.
- [ ] About page: list the game's fonts, art and data sources in the registry entry's `credits`.
- [ ] Sitemap, shelf tile and "More from Plimp" pick the game up from the registry.
- [ ] PR, green CI, check the Vercel preview on a phone, merge.

## Removing a scaffold

Delete the created folders, revert the registry entry, and if `pnpm typecheck` then complains
about the route in `.next/dev/types`, delete `.next/dev`.
