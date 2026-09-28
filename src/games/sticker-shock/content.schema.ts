import * as z from "zod/mini";
import {
  defineContentSpec,
  isoDate,
  itemIdSchema,
  type ContentCheckContext,
  type ContentCheckResult,
  type Sourced,
} from "@/games/content";
import {
  DISPLAY_CURRENCIES,
  MAX_RATIO,
  MIN_RATIO,
  UNITS,
  displayOrderAgrees,
  priceRatio,
  ratioInRange,
  unitsCompatible,
  usdPrice,
} from "./pricing";

// The shape of content/sticker-shock/. zod/mini, so the browser can parse a day's puzzle cheaply.
//
//   items.json      what can be compared: label, quantity, unit, icon, category
//   countries.json  ISO 3166-1 alpha-2 code, name, ISO 4217 currency
//   prices.json     every captured shelf price (built from prices.csv, the source of truth)
//   fx.json         per capture date: US dollars per unit of each currency, with its source
//   polls.json      one-tap poll questions (opinions, no facts)
//   daily/NNNN.json ten generated pairs that embed everything the browser needs
//
// Every price is a fact: its store, source URL, capture date and licence are checked like any
// other source (see facts() below), and it needs a proof image.

export const GAME_SLUG = "sticker-shock";

/** Where placeholder proofs for the sample set live. Never allowed in production. */
export const SAMPLE_PROOF_PREFIX = "/games/sticker-shock/sample-proofs/";

export const currencyCode = z.string().check(z.regex(/^[A-Z]{3}$/, "an ISO 4217 code"));
export const countryCode = z.string().check(z.regex(/^[A-Z]{2}$/, "an ISO 3166-1 alpha-2 code"));
const positive = z.number().check(z.positive());
const shortText = (max: number) => z.string().check(z.minLength(1), z.maxLength(max));

export const unitSchema = z.enum(UNITS);
export const licenceSchema = z.enum(["ODbL", "own"]);
export const displayCurrencySchema = z.enum(DISPLAY_CURRENCIES);

// -------------------------------------------------------------------------------------------
// items.json, countries.json

export const itemSchema = z.strictObject({
  id: itemIdSchema,
  /** Lower case noun as used in a sentence: "eggs", "whole milk". */
  label: shortText(40),
  quantity: positive,
  unit: unitSchema,
  /** Receipt abbreviation, upper case, at most 10 characters: "EGGS", "OLIVE OIL". */
  receipt: z.string().check(z.regex(/^[A-Z0-9 ]{1,10}$/, "upper case, at most 10 characters")),
  /** Name of the flat icon drawn for it (src/games/sticker-shock/art/icons.tsx). */
  icon: itemIdSchema,
  category: z.enum([
    "fruit",
    "vegetables",
    "dairy",
    "bakery",
    "pantry",
    "meat",
    "drinks",
    "snacks",
  ]),
});
export type Item = z.infer<typeof itemSchema>;
export const itemsFileSchema = z.array(itemSchema).check(z.minLength(1));

export const countrySchema = z.strictObject({
  code: countryCode,
  name: shortText(40),
  /** How it reads in a sentence, when it differs from the name: "the Netherlands". */
  inSentence: z.optional(shortText(40)),
  currency: currencyCode,
});
export type Country = z.infer<typeof countrySchema>;
export const countriesFileSchema = z.array(countrySchema).check(z.minLength(1));

// -------------------------------------------------------------------------------------------
// prices.json

const localAsset = z.string().check(z.regex(/^\/[A-Za-z0-9/._-]+$/, "a path under /public"));
export const proofImageSchema = z.union([z.url({ protocol: /^https$/ }), localAsset]);

export const priceSchema = z.strictObject({
  /** Stable and unique, e.g. "jp-eggs-01". Used for crowd data and reports. */
  id: itemIdSchema,
  itemId: itemIdSchema,
  country: countryCode,
  currency: currencyCode,
  /** Shelf price for the pack, tax included. */
  priceLocal: positive,
  /** What the shelf actually sold, e.g. 10 pcs when the item is 12 eggs. */
  packQuantity: positive,
  packUnit: unitSchema,
  /** US dollars per unit of `currency`, frozen at capture (must match fx.json). */
  fxToUsd: positive,
  fxDate: isoDate,
  store: shortText(80),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  proofImage: proofImageSchema,
  capturedOn: isoDate,
  licence: licenceSchema,
  /** Regular shelf price, never a promotion. */
  regular: z.literal(true),
  /** Tax included, as a shopper pays it. */
  taxIncluded: z.literal(true),
  notes: z.optional(z.string().check(z.maxLength(500))),
  sample: z.optional(z.boolean()),
});
export type Price = z.infer<typeof priceSchema>;
export const pricesFileSchema = z.array(priceSchema);

// -------------------------------------------------------------------------------------------
// fx.json

export const fxEntrySchema = z.strictObject({
  date: isoDate,
  /** US dollars per unit of each currency on that date (USD is implied as 1). */
  usdPer: z.record(currencyCode, positive),
  sourceTitle: shortText(200),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  checkedOn: isoDate,
  licence: shortText(120),
  sample: z.optional(z.boolean()),
});
export type FxEntry = z.infer<typeof fxEntrySchema>;
export const fxFileSchema = z.array(fxEntrySchema).check(z.minLength(1));

// -------------------------------------------------------------------------------------------
// polls.json

export const pollSchema = z.strictObject({
  id: z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,40}$/)),
  question: shortText(120),
  options: z.tuple([
    z.strictObject({
      id: z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,31}$/)),
      label: shortText(40),
    }),
    z.strictObject({
      id: z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{0,31}$/)),
      label: shortText(40),
    }),
  ]),
});
export type Poll = z.infer<typeof pollSchema>;
export const pollsFileSchema = z.array(pollSchema).check(z.minLength(1));

// -------------------------------------------------------------------------------------------
// daily/NNNN.json: everything one day needs, so the browser fetches one file.

/** A price as served to the browser: the record plus its item and country. */
export const pricedItemSchema = z.strictObject({
  ...priceSchema.shape,
  item: itemSchema,
  countryName: shortText(40),
  countryInSentence: z.optional(shortText(40)),
});
export type PricedItem = z.infer<typeof pricedItemSchema>;

/** The rates of one capture date that a day needs: display currencies and local currencies. */
export const dayRatesSchema = z.strictObject({
  usdPer: z.record(currencyCode, positive),
  sourceTitle: shortText(200),
  sourceUrl: z.url({ protocol: /^https?$/ }),
  checkedOn: isoDate,
  licence: shortText(120),
  sample: z.optional(z.boolean()),
});
export type DayRates = z.infer<typeof dayRatesSchema>;

export const pairSchema = z.strictObject({
  /** "p0042-03": puzzle 42, pair 3. Used for crowd guesses and reports. */
  id: itemIdSchema,
  kind: z.enum(["same", "different"]),
  a: pricedItemSchema,
  b: pricedItemSchema,
  /** Hand-written "Turns out…" text that replaces the generated sentence. */
  turnsOut: z.optional(shortText(200)),
});
export type Pair = z.infer<typeof pairSchema>;

export const dailyPuzzleSchema = z.strictObject({
  puzzle: z.int().check(z.positive()),
  pairs: z.array(pairSchema).check(z.minLength(1), z.maxLength(20)),
  /** Rates by capture date for every price in the file. */
  rates: z.record(isoDate, dayRatesSchema),
  poll: z.optional(pollSchema),
  sample: z.optional(z.boolean()),
});
export type DailyPuzzle = z.infer<typeof dailyPuzzleSchema>;

/** The Endless pool served by /api/games/sticker-shock/pool. */
export const poolSchema = z.strictObject({
  prices: z.array(pricedItemSchema),
  rates: z.record(isoDate, dayRatesSchema),
  sample: z.optional(z.boolean()),
});
export type Pool = z.infer<typeof poolSchema>;

// -------------------------------------------------------------------------------------------
// Facts and cross-file rules

/** A price as a sourced fact: the store is the source, the capture date is when it was checked. */
export function priceFact(price: Price): Sourced {
  return {
    id: price.id,
    sourceTitle: price.licence === "ODbL" ? `${price.store} (Open Prices)` : price.store,
    sourceUrl: price.sourceUrl,
    checkedOn: price.capturedOn,
    licence: price.licence === "ODbL" ? "ODbL 1.0 (Open Prices)" : "Own screenshot",
  };
}

function fxFact(
  entry: { sourceTitle: string; sourceUrl: string; checkedOn: string; licence: string },
  date: string,
): Sourced {
  return { id: `fx-${date}`, ...entry };
}

/** Rules that span files; see ContentSpec.check. */
export function checkStickerShock(context: ContentCheckContext): ContentCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const items = (context.files["items.json"] as Item[] | undefined) ?? [];
  const countries = (context.files["countries.json"] as Country[] | undefined) ?? [];
  const prices = (context.files["prices.json"] as Price[] | undefined) ?? [];
  const fx = (context.files["fx.json"] as FxEntry[] | undefined) ?? [];
  const polls = (context.files["polls.json"] as Poll[] | undefined) ?? [];

  const itemById = new Map(items.map((i) => [i.id, i]));
  const countryByCode = new Map(countries.map((c) => [c.code, c]));
  const fxByDate = new Map(fx.map((f) => [f.date, f]));

  duplicates(items.map((i) => i.id)).forEach((id) =>
    errors.push(`items.json: duplicate id "${id}"`),
  );
  duplicates(countries.map((c) => c.code)).forEach((c) =>
    errors.push(`countries.json: duplicate code "${c}"`),
  );
  duplicates(prices.map((p) => p.id)).forEach((id) =>
    errors.push(`prices.json: duplicate id "${id}"`),
  );
  duplicates(fx.map((f) => f.date)).forEach((d) => errors.push(`fx.json: duplicate date ${d}`));
  duplicates(polls.map((p) => p.id)).forEach((id) =>
    errors.push(`polls.json: duplicate id "${id}"`),
  );

  for (const entry of fx) {
    for (const currency of DISPLAY_CURRENCIES) {
      if (currency !== "USD" && !entry.usdPer[currency]) {
        errors.push(`fx.json ${entry.date}: needs a ${currency} rate for display`);
      }
    }
  }

  for (const price of prices) {
    const at = `prices.json ${price.id}`;
    const item = itemById.get(price.itemId);
    const country = countryByCode.get(price.country);
    if (!item) errors.push(`${at}: unknown itemId "${price.itemId}"`);
    if (!country) errors.push(`${at}: unknown country "${price.country}"`);
    else if (country.currency !== price.currency) {
      errors.push(`${at}: ${price.country} uses ${country.currency}, not ${price.currency}`);
    }
    if (item && !unitsCompatible(item.unit, price.packUnit)) {
      errors.push(
        `${at}: a pack in ${price.packUnit} cannot be scaled to ${item.quantity} ${item.unit}`,
      );
    }
    const rates = fxByDate.get(price.fxDate);
    const rate = price.currency === "USD" ? 1 : rates?.usdPer[price.currency];
    if (!rates) errors.push(`${at}: fx.json has no entry for ${price.fxDate}`);
    else if (!rate) errors.push(`${at}: fx.json ${price.fxDate} has no ${price.currency} rate`);
    else if (Math.abs(rate - price.fxToUsd) > rate * 1e-9) {
      errors.push(
        `${at}: fxToUsd ${price.fxToUsd} differs from fx.json (${rate} on ${price.fxDate})`,
      );
    }
    if (price.fxDate > price.capturedOn) {
      errors.push(
        `${at}: the rate (${price.fxDate}) is from after the capture (${price.capturedOn})`,
      );
    } else if (daysApart(price.fxDate, price.capturedOn) > 7) {
      warnings.push(
        `${at}: the rate is ${daysApart(price.fxDate, price.capturedOn)} days older than the capture`,
      );
    }
    checkProof(context, at, price, errors);
    if (
      price.licence === "ODbL" &&
      !/^https:\/\/prices\.openfoodfacts\.org\//.test(price.sourceUrl)
    ) {
      warnings.push(`${at}: ODbL prices should link to their Open Prices entry`);
    }
  }

  // Daily files are self-contained (released ones never change), so check what they embed.
  const usedOn = new Map<string, number[]>();
  for (const [n, value] of [...context.daily].sort(([a], [b]) => a - b)) {
    const day = value as DailyPuzzle;
    const at = `daily/${String(n).padStart(4, "0")}.json`;
    const countriesToday = new Set<string>();
    const idsToday = new Set<string>();
    for (const pair of day.pairs) {
      for (const side of [pair.a, pair.b]) {
        countriesToday.add(side.country);
        if (idsToday.has(side.id)) errors.push(`${at}: price ${side.id} appears twice`);
        idsToday.add(side.id);
        usedOn.set(side.id, [...(usedOn.get(side.id) ?? []), n]);
        if (!day.rates[side.fxDate]) errors.push(`${at}: no rates for ${side.fxDate}`);
        checkProof(context, `${at} ${side.id}`, side, errors);
      }
      if (pair.a.country === pair.b.country)
        errors.push(`${at} ${pair.id}: both prices are from ${pair.a.country}`);
      const same = pair.a.itemId === pair.b.itemId;
      if (same !== (pair.kind === "same"))
        errors.push(`${at} ${pair.id}: kind "${pair.kind}" does not match its items`);
      const usdA = usdPrice(pair.a, pair.a.item);
      const usdB = usdPrice(pair.b, pair.b.item);
      const ratio = priceRatio(usdA, usdB);
      if (!ratioInRange(ratio)) {
        errors.push(
          `${at} ${pair.id}: price ratio ${ratio.toFixed(3)} is outside ${MIN_RATIO}–${MAX_RATIO}`,
        );
      }
      const ratesA = day.rates[pair.a.fxDate];
      const ratesB = day.rates[pair.b.fxDate];
      if (
        ratesA &&
        ratesB &&
        !displayOrderAgrees(
          { usd: usdA, usdPer: ratesA.usdPer },
          { usd: usdB, usdPer: ratesB.usdPer },
        )
      ) {
        errors.push(`${at} ${pair.id}: a display currency shows a different order than US dollars`);
      }
    }
    if (countriesToday.size < MIN_COUNTRIES_PER_DAY) {
      errors.push(
        `${at}: uses ${countriesToday.size} countries, at least ${MIN_COUNTRIES_PER_DAY} needed`,
      );
    }
    if (day.poll && !polls.some((p) => p.id === day.poll?.id)) {
      warnings.push(`${at}: poll "${day.poll.id}" is not in polls.json`);
    }
  }
  for (const [id, days] of usedOn) {
    for (let i = 1; i < days.length; i++) {
      const gap = days[i]! - days[i - 1]!;
      if (gap < NO_REPEAT_DAYS) {
        errors.push(
          `price ${id} repeats after ${gap} days (daily ${days[i - 1]} and ${days[i]}); the minimum is ${NO_REPEAT_DAYS}`,
        );
      }
    }
  }

  return { errors, warnings };
}

/** Days between two uses of the same price, at least. */
export const NO_REPEAT_DAYS = 14;
/** Countries per daily puzzle, at least. */
export const MIN_COUNTRIES_PER_DAY = 6;

function checkProof(
  context: ContentCheckContext,
  at: string,
  price: Pick<Price, "proofImage" | "sample">,
  errors: string[],
) {
  const proof = price.proofImage;
  if (proof.startsWith("/")) {
    if (!context.fileExists(`public${proof}`))
      errors.push(`${at}: proof image public${proof} is missing`);
    if (context.mode === "production" && proof.startsWith(SAMPLE_PROOF_PREFIX)) {
      errors.push(`${at}: still uses a sample proof image`);
    }
  }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) (seen.has(v) ? dupes : seen).add(v);
  return [...dupes];
}

function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export const contentSpec = defineContentSpec({
  daily: {
    schema: dailyPuzzleSchema,
    facts: (day) => [
      ...day.pairs.flatMap((pair) => [priceFact(pair.a), priceFact(pair.b)]),
      ...Object.entries(day.rates).map(([date, rates]) => fxFact(rates, date)),
    ],
  },
  files: {
    "items.json": { schema: itemsFileSchema },
    "countries.json": { schema: countriesFileSchema },
    "prices.json": {
      schema: pricesFileSchema,
      facts: (prices) => (prices as Price[]).map(priceFact),
    },
    "fx.json": {
      schema: fxFileSchema,
      facts: (fx) => (fx as FxEntry[]).map((entry) => fxFact(entry, entry.date)),
    },
    "polls.json": { schema: pollsFileSchema },
  },
  check: checkStickerShock,
});
