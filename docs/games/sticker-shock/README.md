# Sticker Shock

Which costs more? Every price is real, with receipts.

- Slug: `sticker-shock`, at `/sticker-shock` (Daily 10) and `/sticker-shock/unlimited` (Endless)
- Engine: `choice` (`src/engines/choice/`)
- Status: live, with a **placeholder** `launchDate` (see `src/games/registry.ts`)
- Crowd: one-tap poll after the daily; one guess per pair (1 right, 0 wrong) for accuracy
- Adding prices: [data-guide.md](data-guide.md)

## How it plays

Two shelf labels show an item, its quantity and a country ("12 EGGS · Japan", "1 KG BANANAS ·
Switzerland"). The player taps the one that costs more. The reveal flips both price stickers to
the display currency, shows both local prices (and the real pack when a price was scaled), the
store and capture date, "See the shelf" (the proof image with its source and licence) and a
"Turns out…" sentence. The receipt printer under the cards types one line per pair.

- **Daily 10**: the same ten pairs for everyone. After pair 10 the whole receipt slides up as the
  results screen (score, streak, best, barcode, countdown), then share and the day's poll.
- **Endless**: random pairs from `GET /api/games/sticker-shock/pool` until the first miss, which
  tears off the receipt. The best run is saved; daily stats and streaks are never touched.

Rules that decide answers:

- The right answer is decided in **US dollars**, with each price's exchange rate frozen at capture
  (`fxToUsd`, `fxDate`). Rates are never fetched live, so an answer never changes.
- Every price is scaled to its item's quantity first (a pack of 10 eggs becomes 12).
- The display currency (CHF, EUR, GBP or USD, default from the browser's region, changeable in
  settings) is cosmetic. Each price converts at its own capture date's rate, and the generator
  drops any pair whose order would look different in any display currency.

## Pairs

The seeded generator (`src/games/sticker-shock/generator.ts`) builds each day:

| Rule          | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Pairs per day | 10: 4 of the same item in two countries, 6 of different ones         |
| Price ratio   | pricier / cheaper between 1.05 and 1.40, in US dollars               |
| Countries     | two per pair, at least 6 per day                                     |
| No repeats    | a price appears at most once in any 14 days of dailies               |
| Variety       | an item at most twice a day; the same two prices not within 120 days |
| Balance       | the pricier item is first 3 to 7 times a day                         |

Days are generated one after the other from a fixed seed (`DAILY_SEED`), so the same data always
gives the same days. **Released puzzles are never rewritten** (players may have played them, the
CDN caches them for a year); `pnpm sticker-shock:build` regenerates only what nobody can have seen.
Endless uses the same pair rules, without the per-day ones, on every price except those in dailies
someone may be playing now or within 7 days.

## Files

| Where                                        | What                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `content/sticker-shock/items.json`           | 25 items: label, quantity, unit, receipt abbreviation, icon, category   |
| `content/sticker-shock/countries.json`       | 20 countries: ISO code, name, currency                                  |
| `content/sticker-shock/prices.csv`           | **the source of truth**, edited in a spreadsheet                        |
| `content/sticker-shock/prices.json`          | built from the CSV by `pnpm sticker-shock:build` (do not edit)          |
| `content/sticker-shock/fx.json`              | per capture date: US dollars per unit of each currency, with its source |
| `content/sticker-shock/polls.json`           | one-tap poll questions (opinions), one per day in turn                  |
| `content/sticker-shock/daily/NNNN.json`      | generated days, self-contained (prices, items, rates, poll)             |
| `content/sticker-shock/csv-mapping.json`     | CSV columns and types                                                   |
| `content/sticker-shock/open-prices-map.json` | items → Open Prices categories (tags checked against the live API)      |
| `src/games/sticker-shock/`                   | schemas, pricing, generator, text, strings, art, components             |
| `src/app/(games)/sticker-shock/`             | the two pages, fonts, OG image                                          |
| `src/app/api/games/sticker-shock/pool/`      | the Endless pool                                                        |
| `public/games/sticker-shock/`                | Tag's static poses, wordmark, flags (from `pnpm sticker-shock:art`)     |
| `supabase/migrations/…_sticker_shock.sql`    | `pair_accuracy` view and the public `proofs` bucket                     |

The sample set (`pnpm sticker-shock:sample`) is 500 **fake** rows: "Sample Mart", made-up prices
and rates, `sample: true`, placeholder proofs watermarked SAMPLE. While any of it is served, the
game shows "Sample data — not real prices", and `CONTENT_MODE=production` fails validation.

## Scripts

| Command                          | What it does                                                              |
| -------------------------------- | ------------------------------------------------------------------------- |
| `pnpm sticker-shock:build`       | CSV → JSON → validation → daily files for the next 365 days → report      |
| `pnpm sticker-shock:proofs`      | cleans metadata from proof images, uploads them, writes URLs into the CSV |
| `pnpm sticker-shock:open-prices` | candidate prices from Open Prices into `review/` (never into prices.csv)  |
| `pnpm sticker-shock:accuracy`    | share of right answers per pair; flags above 85% and below 15%            |
| `pnpm sticker-shock:art`         | exports Tag's poses, the wordmark and the flags to `public/`              |
| `pnpm sticker-shock:sample`      | writes the fake sample set (refuses to overwrite real rows)               |

## World

- **Look**: supermarket-flyer maximalism, flat colour. Shelf-edge label cards (red strip, bold
  item, decorative barcode), 18-point starburst price stickers, a hand-lettered yellow sign, dashed
  cut-here lines, thermal receipt paper with torn zigzag edges and a faint texture.
- **Palette**: receipt white `#FAF7F0`, ink `#1B1B1B`, sale red `#E4002B`, sticker yellow
  `#FFD600`, neon orange `#FF7A1A`. Night shift: background `#141414`, ink `#FAF7F0`; paper stays
  paper. Red text only large; white on red for stickers and strips (4.9:1).
- **Fonts** (this route only): Anton for prices and big numbers, Permanent Marker for signs, IBM
  Plex Mono for receipts. Interface text stays Inter.
- **Mascot**: Tag, a paper price tag on a string, an excitable bargain hunter. One SVG
  (`art/TagArt.tsx`) with six poses; `art/Tag.tsx` adds motion (idle swing, wrong jolt, celebrate
  spin). Static under reduced motion. Readable at 48 px.
- **Icons**: 25 flat item icons drawn for Plimp (`art/ItemIcon.tsx`). Flags from flag-icons (MIT).
- **Sounds** (Web Audio, off by default): scanner beep, cha-ching, low buzz, receipt-printer
  chatter.
- **Signature moment**: the receipt. A line prints per reveal; the full receipt is the results.

## Tests

- Unit: pricing, generator rules, content checks, sentences and share text, the build pipeline,
  metadata stripping, the scripts' logic, a full Daily 10 in jsdom, the pool route, the SQL view.
- End to end (`tests/e2e/sticker-shock.spec.ts`): Daily 10 to the receipt in light and dark with
  axe, already played, proof dialog, clipboard share, Endless ending on the first miss, keyboard
  only, reduced motion, 360 px without sideways scroll.

## Before production

1. Real prices replace the sample set (see [data-guide.md](data-guide.md)).
2. Confirm the launch date in the registry, then `pnpm sticker-shock:build --reset`.
3. `CONTENT_MODE=production pnpm content:validate` passes.
4. Add the data credits you use (Open Prices, the exchange-rate source) to the registry `credits`.

See also [ADDING_A_GAME.md](../../ADDING_A_GAME.md).
