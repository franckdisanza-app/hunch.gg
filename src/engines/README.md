# Engines

Reusable game mechanics, shared by several games: `choice`, `estimate`, `clue` and `map`. Each
engine arrives with the first game that needs it (the choice engine with Sticker Shock) and is
built to be themed, never to look like any one game.

An engine owns rules and state (rounds, answers, scoring); a game owns content, art, strings,
sounds and the reveal. Engines never import from `src/games/<slug>/`.

## choice

"Which one?" games: Sticker Shock, and later Tiptoe, Coined and Chimp.

- `state.ts`: pure rules. A round has 2 or 3 options and the game supplies `correctIndex`. Daily
  mode plays a fixed `list`; unlimited mode asks a `generator` for the next round and can end on
  the first miss (`endOnMiss`). `startChoice` can resume saved answers (`{ roundId, picked }`).
- `useChoiceGame`: the React binding. Keyboard (A/← and B/→ pick, C for a third option, Enter for
  Next), focus (Next after a reveal, the round after moving on), animation hooks (`onPick`,
  `onReveal`, `onFinish`, `revealDelayMs`, which is 0 under reduced motion). Remount it with a
  `key` to restart.
- `ChoiceBoard`: the default markup. Options are real buttons with `aria-keyshortcuts`; the game
  draws them through `renderOption` (with a status: idle, pending, right, wrong, answer, other) and
  the reveal through `renderReveal`; `announce` fills a polite live region. `actionBar` keeps
  Next in one place (e.g. pinned to the bottom of the screen), with `idle` content before a pick.
- `summary.ts`: score, streaks and the emoji grid for stats and the share text.

No strings live in the engine: every label comes from the game.

## map

"Where is it?" games: Ping, and later Souvenir. Everything that is specific to one game (what the
targets are, colours, strings, sounds, the reveal card) stays in the game.

- `geo.ts`: pure spherical helpers on `{ lat, lon }`: great-circle `distanceKm` (d3-geo ×
  6,371 km), `nearestTarget`, `geodesicCircle`, `circleIntersections` (where two rings cross),
  `greatCircleArc`, bounding boxes across the antimeridian, `scopeSizeKm` (how big an area is),
  `unitForLocale` (km or mi), `formatDistance`, `formatLatLon`.
- `scoring.ts`: scoring relative to a round's scope. A pin inside the perfect radius scores
  `maxPoints` on any attempt (unless `weightPerfect`); a miss scores
  `maxPoints · e^(−d / (decay × scopeKm))` times its attempt weight; a round scores its best pin.
  The default perfect radius is `perfect × scopeKm` with a floor; `bands` split misses by
  fraction of the scope (hot and cold words, share squares). All numbers come from the game.
- `state.ts`: pure rules. A round has targets (several for disputed answers; pins score against
  the nearest), a scope size and a perfect radius; up to `weights.length` pins; `startMap` resumes
  saved pins (`saveMap`), `dropPin`, `nextRound`, `summarizeMap`.
- `camera.ts`: the view (point under the crosshair, zoom), north always up: `dragBy`, `zoomBy`,
  `nudge` (arrow keys), `frameFor` (fit points, first point first), `flightPath` (fly-to along the
  great circle, pulling back on long flights).
- `atlas.ts`: world-atlas land and countries (Natural Earth, public domain), 1:110m after the first
  draw and 1:50m once zoomed in, each its own lazy chunk; `countryAt` for screen readers.
- `draw.ts` + `Globe.tsx`: the orthographic globe on a canvas at the device pixel ratio. Drag with
  inertia, pinch, wheel; arrows, +/− and Enter on the focused globe; a fixed crosshair; rings that
  grow from a pin and freeze (with a glow where two cross), pins, target blips (filled when
  official, open for contenders), arcs, a radar sweep that lights the blips, and `flyTo`. Colours
  may be `var(--…)` references, so the globe follows the game's light and dark themes. Under
  reduced motion: no inertia, flights or sweeps. `aim()` stops any glide and returns the point
  under the crosshair.
- `useMapGame`: the React binding: state, `onPin` / `onReveal` / `onFinish`, focus (Next after a
  reveal, the globe on a new round).

The whole engine loads only on routes that render a globe; `/dev/globe` shows it with a fake
target.
