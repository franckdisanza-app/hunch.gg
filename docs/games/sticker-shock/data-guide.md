# Sticker Shock: adding real prices

How to replace the sample set with real prices, from choosing what to compare to publishing a
year of daily puzzles. Nothing in the game is made up: every price needs a proof image, a source
URL, a capture date and a licence, and validation refuses anything else.

## 1. How many prices you need

Each day uses 20 prices, and a price may appear only once in any 14 days, so about 260 prices are
"in use" at any time. The generator also needs room to find pairs within the 5–40% price window.

- **Minimum**: about 350 prices. Below that, `pnpm sticker-shock:build` stops and says which day it
  could not build.
- **Comfortable**: 400–500 prices, for example 25 items × 16–20 countries.
- Same-item pairs need the same item in several countries: aim for every item in at least 8.

## 2. Items

The 25 items live in `content/sticker-shock/items.json`. Each has:

| Field      | Example | Notes                                                                    |
| ---------- | ------- | ------------------------------------------------------------------------ |
| `id`       | `eggs`  | lower case, stable: price IDs and icons refer to it                      |
| `label`    | `eggs`  | lower case noun as used in a sentence ("12 eggs", "1 kg of bananas")     |
| `quantity` | `12`    | the amount every price is scaled to                                      |
| `unit`     | `pcs`   | `kg`, `g`, `l`, `ml` or `pcs`                                            |
| `receipt`  | `EGGS`  | upper case, at most 10 characters                                        |
| `icon`     | `eggs`  | a key in `src/games/sticker-shock/art/ItemIcon.tsx` (new items need art) |
| `category` | `dairy` | fruit, vegetables, dairy, bakery, pantry, meat, drinks, snacks           |

Good items are sold everywhere, in comparable form: plain produce, basic groceries, the cheapest
common variety or the store's own brand. Avoid seasonal-only products, anything with regulated
prices, and items whose "normal" form differs a lot between countries.

## 3. Countries

`content/sticker-shock/countries.json` has 20 countries (ISO 3166-1 alpha-2 code, name, ISO 4217
currency, and `inSentence` when a sentence needs "the", as in "the Netherlands").

Choose countries with:

- **one market exchange rate**: skip any country with an official and a parallel rate;
- **moderate inflation**: skip very-high-inflation markets, where a price is stale in weeks (and
  skip Cuba and Venezuela);
- **online supermarkets that show prices** without an account (asking for a postcode is fine).

For each country, pick one or two large supermarket chains with online shops and stick to them, so
prices stay comparable. Write down the store (and city, when prices differ by region).

## 4. Capturing a price

1. **Regular price only.** Never a promotion, a loyalty or member price, a multi-buy or a
   clearance sticker. If the page shows a crossed-out price, skip it.
2. **Tax included**, as a shopper pays it. Watch out where shelf prices exclude sales tax (the
   United States and Canada): add the tax that applies to that food at that store, or skip it, and
   say which in `notes`. Leave out refundable bottle deposits and say so in `notes`.
3. **The pack as sold.** Record the real pack (`packQuantity`, `packUnit`); the game scales it to
   the item and shows "€3.49 for 10, scaled to 12" on the reveal.
4. **Take the proof**: a screenshot of the product page (or a photo of the shelf label) that shows
   the price, the pack size and the store. Crop out anything personal (account names, addresses,
   delivery slots). Keep it under 1.5 MB (JPEG, PNG or WebP).
5. **Name the file after the price ID**: `<country>-<item>-<nn>`, for example `jp-eggs-01.png`,
   `ch-eggs-02.jpg`. Put it in `content/sticker-shock/proofs-inbox/` (not committed).

## 5. Exchange rates

`content/sticker-shock/fx.json` has one entry per capture date: US dollars per unit of every
currency captured that day, plus CHF, EUR and GBP (the display currencies), with its source:

```json
{
  "date": "2026-10-05",
  "usdPer": { "CHF": 0.0, "EUR": 0.0, "GBP": 0.0, "JPY": 0.0 },
  "sourceTitle": "Name of the rate source",
  "sourceUrl": "https://…",
  "checkedOn": "2026-10-05",
  "licence": "the source's reuse terms"
}
```

(Replace the zeros with the day's real rates.) Use one published reference source, for example
the European Central Bank's euro reference rates (check their reuse terms). Its rates are per euro:
US dollars per unit of X = (USD per EUR) ÷ (X per EUR). Use the rate of the capture day, or the last
published day before it. Validation fails if a rate is dated after the capture and warns if it is
more than 7 days older.

In `prices.csv` you may leave `fxToUsd` empty: the build fills it in from `fx.json`.

## 6. Filling in `prices.csv`

Open `content/sticker-shock/prices.csv` in a spreadsheet. One row per price:

| Column         | Example (fake)                 | Notes                                              |
| -------------- | ------------------------------ | -------------------------------------------------- |
| `id`           | `jp-eggs-01`                   | unique, stable, same as the proof file name        |
| `itemId`       | `eggs`                         | from items.json                                    |
| `country`      | `JP`                           | from countries.json                                |
| `currency`     | `JPY`                          | must be the country's currency                     |
| `priceLocal`   | `0`                            | the shelf price for the pack, tax included         |
| `packQuantity` | `10`                           | what the shelf sold                                |
| `packUnit`     | `pcs`                          | must scale to the item's unit                      |
| `fxToUsd`      | _(empty)_                      | filled in from fx.json                             |
| `fxDate`       | `2026-10-05`                   | the date of the rate in fx.json                    |
| `store`        | `Example Store`                | retailer name, shown on the reveal                 |
| `sourceUrl`    | `https://example.test/product` | the product page, or the Open Prices entry         |
| `proofImage`   | _(empty)_                      | filled in by `pnpm sticker-shock:proofs`           |
| `capturedOn`   | `2026-10-05`                   | the day you saw the price                          |
| `licence`      | `own`                          | `own` for your screenshots, `ODbL` for Open Prices |
| `regular`      | `true`                         | you checked it is the regular price                |
| `taxIncluded`  | `true`                         | you checked tax is included                        |
| `notes`        | `deposit excluded`             | free text, never shown to players                  |
| `sample`       | _(empty)_                      | only for the fake sample set                       |

Export as CSV (UTF-8, comma-separated). **Delete every sample row** (`sample` = `true`) when you
start: sample and real prices must never share a day.

### Open Prices (optional)

`pnpm sticker-shock:open-prices` pulls recent, non-discounted prices with a proof from
[Open Prices](https://prices.openfoodfacts.org) for the items in `open-prices-map.json` (produce by
the kilogram, eggs per unit) in our 20 countries, into `content/sticker-shock/review/…csv`. It never
touches `prices.csv`. For each candidate you keep:

- open the Open Prices entry and the proof, and check it is a regular, tax-included price;
- check the licence of the proof image on Open Prices before re-hosting it, then save it to
  `proofs-inbox/` under the row's ID;
- fill in `regular`, `taxIncluded` and the rate, and copy the row into `prices.csv`.

Open Prices data is published by Open Food Facts under the Open Database License (ODbL). Rows keep
`licence: ODbL` and the link to their entry; add Open Prices to the game's `credits` in the registry
once you use any.

## 7. Running the scripts

You need `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `.env.local` for the proofs step, and the
migrations pushed (`pnpm exec supabase db push`), which creates the public `proofs` bucket.

```bash
pnpm sticker-shock:proofs
```

Removes metadata (EXIF with GPS, XMP, text chunks), names each file by its content, uploads it and
writes its URL into `prices.csv`. Add `--dry-run` to see what would happen.

```bash
pnpm sticker-shock:build
```

Converts the CSV, validates everything, writes daily files for the next 365 days and prints a
report: pair types (40/60), the price-ratio spread, countries per day, the closest reuse of a price
(must be 14 days or more) and prices never used. Fix every error it lists and run it again.

Before launch, set the real launch date in `src/games/registry.ts` and regenerate every day:

```bash
pnpm sticker-shock:build --reset
```

`--reset` rewrites released puzzles too, so only use it while nobody has played them. After launch,
a plain `pnpm sticker-shock:build` keeps every released day exactly as it was.

Then check what production will accept:

```bash
CONTENT_MODE=production pnpm content:validate
```

It fails while any sample row, sample rate or placeholder proof remains.

## 8. After launch

- Add prices regularly and run `pnpm sticker-shock:build`: at least 14 days of daily files must
  exist ahead of today (30 to avoid warnings).
- Once a week, run `pnpm sticker-shock:accuracy`. Pairs above 85% right are too easy; pairs below
  15% are worth a second look at the data (a wrong pack size or a promotion slips in).
- Mistake reports arrive in the `reports` table in Supabase, with the pair ID.
- A wrong price in a released day: fix it in `prices.csv` for future days, and correct the released
  file by hand only if the answer itself was wrong (then redeploy so the CDN serves the new file).
