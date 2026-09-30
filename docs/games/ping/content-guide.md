# Ping content guide

How to write Ping's questions: a precise question, the right perfect radius, contenders for
disputed records, computed "furthest from" answers, and how to verify a draft. Everything lives in
`content/ping/questions.json`; `pnpm ping:build` turns it into daily files.

**Nothing is made up.** Every value, date, place and source comes from the source you cite, and
a person has checked it. A question stays `"sample": true` (a draft) until then; drafts show a
banner in the game and fail the production build.

## 1. Write a precise question

A good Ping question is a "where would X be?" riddle with exactly one defensible answer (or a
known set of contenders). The prompt:

- **Names the measure** exactly: "the highest air temperature ever officially recorded", "the
  highest average annual rainfall", "the furthest point from any road". Not "the hottest place".
- **Names the authority** in brackets: "(WMO)", "(MeteoSwiss)". Computed questions name
  OpenStreetMap: "(OpenStreetMap data)".
- **Names the scope** when it is not the whole world: "in Switzerland", "in the contiguous US".
- **Dates computed answers:** "as of September 2026" (the build refuses a computed question
  without "as of").
- **Never names the answer**, not even a nearby town (the build refuses a prompt or teaser that
  contains a target's label or a nearest feature's name).

The **teaser** is a short, spoiler-free version for the share text: "Where was the hottest
temperature ever recorded?". The **turnsOut** line completes "Turns out…" in our own words: the
surprise, the dispute, the context. Keep it under 280 characters.

## 2. Fields

| Field                                              | Meaning                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                               | Stable, lowercase with dashes, e.g. `heat-world-record`. Used for crowd data and reports.                                                                                                                    |
| `category`                                         | `heat`, `cold`, `rain`, `wind`, `geography`, `furthest-from` (computed) or `regional`.                                                                                                                       |
| `prompt`, `teaser`, `turnsOut`                     | See above.                                                                                                                                                                                                   |
| `scope`                                            | `{ level, name, bbox? }`: `world`, or `continent` / `region` / `country` with a bounding box `[west, south, east, north]` in degrees (west > east across the antimeridian). Every target must lie inside it. |
| `targets[]`                                        | `lat`, `lon`, `label` (the place as the reveal names it), `official` (true for the record the authority lists), `value`, `unit`, `date` (`YYYY-MM-DD`, `YYYY-MM`, `YYYY` or a period `YYYY/YYYY`).           |
| `perfectRadiusKm`                                  | Optional: overrides the default perfect radius (below).                                                                                                                                                      |
| `authority`                                        | Who keeps the record, spelled out: "World Meteorological Organization".                                                                                                                                      |
| `sourceTitle`, `sourceUrl`, `checkedOn`, `licence` | The exact page you checked, when you checked it, and how we use it (e.g. "Fact, not copyrightable; own wording").                                                                                            |
| `computedOn`, `dataAsOf`, `nearest[]`              | Computed questions only: when you ran the script, the date of the OpenStreetMap data, and the three nearest features (`name`, `town`, `lat`, `lon`).                                                         |
| `shareEmoji`                                       | Optional: replaces the category emoji in the share text (e.g. 🍔).                                                                                                                                           |
| `sample`                                           | `true` until a person has verified the question.                                                                                                                                                             |

Where the answer lies (land, ocean, Antarctica) is worked out by `pnpm ping:build` from Natural
Earth's land shapes; you do not write it.

## 3. Choose the scope and the perfect radius

Misses are scored relative to the scope's size (the widest distance across its box), so the
scope is part of the question's difficulty:

| Scope               | Example size | Default perfect radius | Score falls to 37% at |
| ------------------- | ------------ | ---------------------- | --------------------- |
| World               | 20,015 km    | 50 km                  | 1,500 km              |
| Continent-sized box | ~6,000 km    | 15 km                  | 450 km                |
| Region              | ~2,000 km    | 5 km                   | 150 km                |
| Country             | ~400 km      | 5 km (the floor)       | 30 km                 |

Pick the smallest scope the prompt honestly names: "in Switzerland" is a country scope with
Switzerland's box, not the world. Then decide whether the default radius is fair:

- **A single station or spot** (a weather station, a summit, a computed point): the default is
  right.
- **A broad feature** (a desert basin, a rainforest region, a long ridge): set
  `perfectRadiusKm` to roughly the feature's half-width, so a pin anywhere on it counts.
- **A record the source only places loosely** ("near the village of …"): widen the radius to
  cover that uncertainty rather than inventing a precise point.

A pin at the edge of the radius scores 1,000; just outside it scores a little less. Players aim
at the crosshair on a globe, so do not go below 5 km.

## 4. Disputed records: add every contender

When serious sources disagree, every serious contender is a target:

- Mark the record the named authority lists `"official": true`; the others `false`. At least one
  target must be official.
- Give each target its own `value`, `unit` and `date` as its source states them. If a contender
  comes from a different source, name it in `turnsOut` or pick a source that discusses the
  dispute (the question has one source line).
- Pins score against the **nearest** target: a player who knows either answer is right.
- The reveal lights every target (filled: official; open ring: contender) and lists them with
  their values, the official one marked. Make the dispute the "Turns out…" moment.

## 5. Computed questions: `pnpm ping:furthest`

```bash
PING_OSM_CONTACT="you@example.test" pnpm ping:furthest --region "Switzerland" --what highway
```

- `--region`: a country by its Natural Earth name (as in world-atlas: "Switzerland", "United
  States of America"; the script suggests names when one does not match), or a GeoJSON file of
  polygons for anything else: a continent, a state, the contiguous US. Make one from Natural
  Earth's admin files with any GIS tool that writes GeoJSON (mapshaper.org works in a browser):
  select the polygons, dissolve them, export.
- `--what`: the inside of an Overpass tag filter. `highway` (any road), `amenity=fast_food`,
  `"brand:wikidata"="Q…"` for a chain (look the chain's Wikidata ID up on its OpenStreetMap wiki
  page; brand tags are more reliable than names). Several filters: `amenity=fuel][brand=…`.
- `--buffer-km` (default 150): how far outside the region features are fetched. Features across
  a border count; the script widens the buffer by itself when the answer lies further out.
- `--grid-km`: the first grid's spacing (default about a 150th of the region); the refinement
  then gets to within about 10 m.

It queries the Overpass API once per region and filter (cached in `.cache/ping/`; please set
`PING_OSM_CONTACT`, the operators ask for a way to reach you) and prints the answer, its
distance, the three nearest features with links, and a snippet for `questions.json`. Then:

1. Open the answer and the nearest features on openstreetmap.org and check them: a mis-tagged
   feature can move the answer. If one is wrong, fix it on OpenStreetMap or leave the question.
2. Write the `label` yourself (where the point is, e.g. "a meadow above the village of …"), and
   the prompt with "as of <month year>" and "(OpenStreetMap data)".
3. Keep `computedOn`, `dataAsOf` and the licence "ODbL 1.0 (© OpenStreetMap contributors)".
4. Chain names appear in text only: no logos, neutral wording, nothing implying endorsement.
5. **Recompute before any reuse.** Places open and close; an old answer may no longer be true.

## 6. Verify a draft

For every question still marked `"sample": true`:

- [ ] Open `sourceUrl`. It is the exact page, and it states the value, unit, date and place.
- [ ] The prompt names the measure, the authority and the scope, and matches what the source
      measures (air temperature in the shade is not ground temperature).
- [ ] Each target's coordinates are the place the source means (a station's published
      coordinates, not a town centre), and it is inside the scope's box.
- [ ] The official flag matches the authority; contenders are serious and sourced.
- [ ] `turnsOut` is in our own words and true; the teaser gives nothing away.
- [ ] `checkedOn` is today; `licence` is filled in.
- [ ] Remove `"sample": true`.
- [ ] `pnpm ping:build`, then `pnpm content:validate`, then play the day in `pnpm dev`.

Before launch, `CONTENT_MODE=production pnpm content:validate` must pass: no draft may remain.

## 7. Building the days

`pnpm ping:build` plans the daily files from a fixed seed:

- Never two questions of one category on a day.
- At most one ocean or Antarctica answer in any 7 days.
- Released days (up to today's puzzle in UTC+14) keep their questions; later days are planned
  again on every run, so edits and new questions flow in. A corrected question is refreshed in
  every day that uses it.
- The report shows categories per week, how many days are planned and how many fresh days are
  left. A live game needs 14 days ahead (30 to avoid warnings).

`--repeat` reuses questions once all are used (only for the sample set); `--reset` replans
released days too (only before launch, while nobody has played them).
