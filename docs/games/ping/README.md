# Ping

Pin the world's extremes: hottest, wettest, farthest.

- Slug: `ping` · Engine: `map` (`src/engines/map/`) · Status: live, on draft questions and a
  placeholder launch date (see `src/games/registry.ts`)
- Mascot: Sonde, a small white weather balloon with a radiosonde box on its string
- Content: `content/ping/questions.json` and `content/ping/daily/NNNN.json`; how to write it:
  [content-guide.md](content-guide.md)

## Concept

Three questions a day about the world's extremes. Every question is a "where would X be?" riddle,
never a named place: the player reasons about the world and drops a pin on a globe. A miss sends
a hint, a different one per pin (`HINTS` in `config.ts`):

- **First miss: the direction.** A wedge fans out from the pin towards the answer, one of 8 map
  directions (N, NE, E, … NW), with an arrow and its letters. Map directions as read off a map
  with north up: north is towards the North Pole, east and west the shorter way round (rhumb
  lines, which follow the globe's grid; never the great circle's starting bearing). The wedge
  always covers its whole 45° compass point, never the exact bearing.
- **Second miss: the distance.** A **ping**: a ring races out from the pin and freezes at the
  distance to the answer, coloured cold to hot with the distance and a word (Freezing, Cold, Warm,
  Hot, Burning).
- **Third pin:** its ring leads into the reveal.

Three pins per question; the first one, the hunch, counts most. The first hint gives nothing
away about the distance: no points per pin while aiming (they show in the card and the results),
Sonde points the way, and the sound is a "this way" chirp rather than the pitched sonar. The
reveal flies to the answer, a radar sweep lights it (and every contender for a disputed record),
and a card shows the value, date, place, authority and source.

- **Daily:** 3 questions, the same for everyone, about 2–3 minutes.
- **Practice** (`/ping/unlimited`): 3 random questions from days that are over everywhere on
  Earth (`/api/games/ping/practice`). Never today's or a future one; never touches daily stats.

## Scoring (`src/games/ping/config.ts`)

Everything is measured against the **scope** of the question: the area it is about (the world, a
continent, a region, a country), sized by the widest distance across its bounding box
(`scopeSizeKm`; the whole world is 20,015 km, half the circumference).

| Rule                 | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfect radius       | 0.25% of the scope (50 km on the world), at least 5 km, or the question's own `perfectRadiusKm`                                                |
| Perfect pin          | 1,000 points on any attempt, and the question ends                                                                                             |
| Miss                 | `round(1000 · e^(−d / (7.5% of the scope)))` (1,500 km on the world), capped at 999                                                            |
| Attempt weights      | 1.0, 0.5, 0.25: a miss scores its base × the weight of its attempt                                                                             |
| Question score       | the best pin                                                                                                                                   |
| Daily maximum        | 3,000                                                                                                                                          |
| Bands (share, words) | under 5% of the scope 🟩 Burning, 15% 🟨 Hot, 30% 🟧 Warm, 50% 🟥 Cold, farther 🟥 Freezing (on the world: ~1,000, ~3,000, ~6,000, ~10,000 km) |

A pin scores against the **nearest** target, so a disputed record with several contenders
accepts any of them. Tune the numbers after playtesting with `pnpm ping:difficulty` (median
first-pin distance per question from the crowd guesses); they live in one file.

Note: a direction and one distance leave a 45° stretch of the ring to search (the wedge crosses
the ring there), so the third pin can be close but is rarely perfect by geometry alone. Because a
perfect pin scores 1,000 on any attempt, a lucky third pin still scores full marks; set
`weightPerfect: true` to weight perfect pins like misses (500 on the second, 250 on the third).

## Round flow

1. The question appears with its category icon and scope; the globe starts on the scope (the
   whole world, or the scope's box) under a fixed crosshair.
2. The player spins and zooms the globe (drag with inertia, pinch, wheel; − and + buttons; arrows,
   +/− on the keyboard) and taps **Drop pin** (or Enter on the globe). Zoomed in, cities and roads
   help them find their way.
3. A pin inside the perfect radius solves the question at once (a balloon squeak).
4. Otherwise the hint. First pin: the wedge opens towards the answer, labelled with its compass
   point, and Sonde points. Second pin: the ring grows to the target's distance and freezes,
   labelled with the distance (km or mi, from the settings or the browser's locale) and a heat
   word, and a sonar ping rises in pitch the closer the pin. Wedges and rings stay.
5. After a perfect pin or the third pin: the globe flies to frame the answer and the pins, the
   radar sweep lights every target (filled: official; open: contender), and the card slides up.
6. After question 3: the results (points per question, squares, streak, countdown), share and
   Practice.

## Screen

The play screen fills the screen and never scrolls (the frame's `FillScreen`): phones get one
column (status, question, globe, hints, button) with the globe taking whatever height is left;
wide screens and landscape phones a side panel (question, hints, then the card, and the button)
beside a globe that fills the rest (about 980 × 810 px at 1440 × 900). The globe's area keeps its
size while the player aims; at the reveal the card takes room from it on phones, and scrolls
inside its panel when it is longer than the space. The results page scrolls as usual.

## Content and sources

Three families of questions, all dated and sourced:

| Family                   | Example                                                        | Source                                             |
| ------------------------ | -------------------------------------------------------------- | -------------------------------------------------- |
| World records            | lowest temperature, highest wind gust, driest place            | the WMO World Weather and Climate Extremes Archive |
| Computed "furthest from" | furthest point in a country from any road, or from a chain     | our own script on OpenStreetMap (ODbL)             |
| Regional extremes        | the hottest place in a country, the highest village in a range | national weather services and statistics offices   |

Every question carries `sourceTitle`, `sourceUrl`, `checkedOn`, `licence` and its `authority`,
and the reveal shows them. Disputed records list every serious contender as a target, with the
official one marked. Computed questions store `computedOn`, `dataAsOf` and the three nearest
features, and say "as of <month year>" in the prompt: they move when places open or close, so
recompute before any reuse.

Today the content is **10 real records, still drafts** (`sample: true`): the owner's list,
researched at their sources (WMO's records table, the International Journal of Climatology, the
Israel Water Authority's open data, the UK Met Office's Meteorological Magazine, The Kathmandu
Post), each waiting for a person to verify it ([drafts.md](drafts.md) has the checklist). The
game shows "Draft content — facts not yet verified" while any is served, and
`CONTENT_MODE=production` rejects them, so a production build fails until they are verified. Ten
questions make about three days; the days reuse them (`pnpm ping:build --repeat`) until more
arrive.

## Scripts

| Command                | What it does                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm ping:sample`     | Writes 20 fake sample questions (seeded). Refuses to overwrite anything but its own fakes, drafts included.                                                                                                                                                                                                                                                                  |
| `pnpm ping:build`      | Validates the questions and plans daily files from a fixed seed with the mix rules (never two questions of a category on a day; at most one ocean or Antarctica answer in any 7 days). Released days keep their questions; `--repeat` reuses questions (the sample set), `--reset` replans released days (before launch only). Prints categories per week and the days left. |
| `pnpm ping:furthest`   | `--region <country or GeoJSON> --what <OSM tag filter>`: the point in the region furthest from any matching OpenStreetMap feature, with the three nearest features.                                                                                                                                                                                                          |
| `pnpm ping:difficulty` | Median first-pin distance per question, from Supabase.                                                                                                                                                                                                                                                                                                                       |
| `pnpm ping:art`        | Exports Sonde's static poses, the share-image Sonde, the wordmark and the globe pictures to `public/games/ping/`.                                                                                                                                                                                                                                                            |

## World

- **Look:** a modern weather-radar console. A dark globe with a faint graticule as the radar
  grid, isobar contours behind it, readouts in JetBrains Mono, headings and big numbers in
  Unbounded. Rounded, friendly shapes, never military. Zoomed in, cities (dots and names) and
  roads (Natural Earth, `pnpm map:data`) appear, more of them the closer the view.
- **Palette** (`palette.ts`, `theme.ts`): night navy `#0B1626`, ink `#EAF2FF`, radar green
  `#3DDC97`, grid `#1E2E44`; heat ramp cold `#4C8DFF` → mild `#FFD34D` → hot `#FF5A4E`. Light
  variant ("printed weather chart"): paper `#F3F6FA`, ink `#0B1626`, radar green `#0B7A54` for
  text (the `#0F8A5F` of the lines is only 4.0:1 on paper) and light-grey isobars. Every text
  colour reaches AA on every surface (`theme.test.ts`). Colour is never the only signal: rings
  carry their distance and word, contenders are open rings and labelled.
- **Mascot:** Sonde (`art/SondeArt.tsx`, motion in `art/Sonde.module.css`): idle bobs, thinking
  turns, correct puffs up with a green light, wrong sags, celebrate rises in ping rings, point
  swings the box towards the reveal. Still under reduced motion.
- **Sounds** (`sounds.ts`, Web Audio, off by default): a "this way" chirp for the direction hint,
  the sonar ping (pitch by band) for the distance, a soft sweep at the reveal, a balloon squeak on
  a perfect pin.
- **Share image:** a dark globe drawn with d3-geo, three heat rings meeting at one spot, Sonde and
  the tagline (`src/app/(games)/ping/opengraph-image.tsx`).
- **First paint:** the globe picture (`components/GlobePicture.tsx`, `public/games/ping/globe-*.svg`
  from `pnpm ping:art`) is the page's largest paint: one SVG for the system's colour scheme,
  preloaded from the head. The canvas globe leaves it showing (the engine's `backdrop`) until the
  view changes or a pin lands, and a question that opens zoomed in keeps the 1:110m shapes until
  the player first moves the globe. A theme picked in the settings that differs from the system's
  hides the picture and the canvas draws at once.

## Share

```
Ping #12 · 2,140/3,000
🌡️ 🟨🟩🎯
🌧️ 🟥🟨🟩
📍 🟥🟥🟨
Where was the hottest temperature ever recorded?
https://plimp.lol/ping?ref=share
```

One line per question: its category emoji (or the question's `shareEmoji`), one square per pin.
The teaser is one of today's questions (rotating by puzzle number), never an answer: any line that
contains a target's or a nearest feature's name is refused.

## Crowd and analytics

Daily mode only: after each question, `POST /api/guess` with the first pin's distance in km
(`itemId`: the question ID). Analytics: `game_start`, `game_complete`, `share_click` and the
other frame events only.

## Launch checklist

See [ADDING_A_GAME.md](../../ADDING_A_GAME.md). For Ping in particular: replace the sample set
with verified questions (content guide), pick the real `launchDate` and run
`pnpm ping:build --reset`, check `CONTENT_MODE=production pnpm content:validate`, then set the
registry entry to `live` with its theme and mascot.
