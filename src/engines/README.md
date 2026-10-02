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
  `unitForLocale` (km or mi), `formatDistance`, `formatLatLon`. Map directions, as read off a map
  with north up: `rhumbBearing` (the compass bearing of the rhumb line, east and west the shorter
  way round, never the great circle's starting bearing), `rhumbDestination`, `rhumbLine`,
  `compassPoint` (8 points).
- `scoring.ts`: scoring relative to a round's scope. A pin inside the perfect radius scores
  `maxPoints` on any attempt (unless `weightPerfect`); a miss scores
  `maxPoints · e^(−d / (decay × scopeKm))` times its attempt weight; a round scores its best pin.
  The default perfect radius is `perfect × scopeKm` with a floor; `bands` split misses by
  fraction of the scope (hot and cold words, share squares). All numbers come from the game.
- `state.ts`: pure rules. A round has targets (several for disputed answers; pins score against
  the nearest), a scope size and a perfect radius; up to `weights.length` pins, each with its
  distance and map `bearing` to the nearest target (the game picks which it shows as a hint);
  `startMap` resumes saved pins (`saveMap`), `dropPin`, `nextRound`, `summarizeMap`.
- `camera.ts`: the view (point under the crosshair, zoom), north always up: `dragBy`, `zoomBy`,
  `nudge` (arrow keys), `frameFor` (fit points, first point first), `flightPath` (fly-to along the
  great circle, pulling back on long flights), `viewAngle` (how far the view reaches), `mapZoom`
  (the globe's zoom and size as a web map's zoom level).
- `atlas.ts`: world-atlas land and countries (Natural Earth, public domain), 1:110m as soon as the
  globe mounts and 1:50m once zoomed in, each its own lazy chunk; `countryAt` for screen readers.
  A view that opens zoomed in keeps the 1:110m shapes until the player first turns, zooms or aims
  the globe (or the game moves it), so ~750 KB of shapes never compete with the first paint.
- `overlays.ts`: cities and roads from Natural Earth (public domain), in compact files under
  `public/map/v1/` written by `pnpm map:data` (`scripts/map/`). `MapOverlays` fetches each file
  only when a view needs it: the biggest places past the opening zoom, the rest at country zoom,
  major roads for continent views, then 15° tiles of every road. Each place and road shows from
  the web-map zoom Natural Earth gives it (`OVERLAY_ZOOM` sets the leads and lags).
- `draw.ts` + `Globe.tsx`: the orthographic globe on a canvas at the device pixel ratio. Drag with
  inertia, pinch, wheel; arrows, +/− and Enter on the focused globe, and `zoomBy()` for on-screen
  buttons; a fixed crosshair; rings that grow from a pin and freeze (with a glow where two cross),
  direction wedges (a sector of map directions from a pin, with an arrow and a label), pins,
  target blips (filled when official, open for contenders), arcs, a radar sweep that lights the
  blips, and `flyTo`. Roads under the game's marks; city dots and names on top, never over a game
  label, marker or the crosshair (`labelInsets` keep labels off the game's own overlays), and the
  major roads alone while the globe moves. Colours may be `var(--…)` references, so the globe
  follows the game's light and dark themes. Under reduced motion: no inertia, flights or sweeps.
  `aim()` stops any glide and returns the point under the crosshair. `backdrop`
  (`{ view, visible? }`): a static picture under the canvas that already shows `view`; while the
  camera is on it and the scene is empty the canvas draws nothing (`showsOnlyBackdrop`), so the
  page pays for no drawing until the view changes or a pin lands. Screen readers hear the
  coordinates, the country and the nearest place when the crosshair settles.
- `useMapGame`: the React binding: state, `onPin` / `onReveal` / `onFinish`, focus (Next after a
  reveal, the globe on a new round).

The whole engine loads only on routes that render a globe; `/dev/globe` shows it with a fake
target. Its city and road files load only once the player zooms in.
