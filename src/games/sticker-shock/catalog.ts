import type {
  Country,
  DailyPuzzle,
  DayRates,
  FxEntry,
  Item,
  Pair,
  Poll,
  Pool,
  Price,
  PricedItem,
} from "./content.schema";
import type { GeneratedDay, GeneratorPrice } from "./generator";
import { DISPLAY_CURRENCIES, usdPrice } from "./pricing";

// Joins prices with their items, countries and exchange rates into what the generator, the daily
// files and the Endless pool need. Pure: the build script and the pool route read the files.

export interface Catalog {
  items: readonly Item[];
  countries: readonly Country[];
  prices: readonly Price[];
  fx: readonly FxEntry[];
}

export function pricedItem(price: Price, catalog: Catalog): PricedItem {
  const item = catalog.items.find((i) => i.id === price.itemId);
  const country = catalog.countries.find((c) => c.code === price.country);
  if (!item) throw new Error(`${price.id}: unknown item ${price.itemId}`);
  if (!country) throw new Error(`${price.id}: unknown country ${price.country}`);
  return {
    ...price,
    item,
    countryName: country.name,
    ...(country.inSentence ? { countryInSentence: country.inSentence } : {}),
  };
}

/** The rates a set of prices needs, by capture date: display currencies plus their own. */
export function ratesFor(
  prices: readonly Pick<Price, "fxDate" | "currency">[],
  fx: readonly FxEntry[],
): Record<string, DayRates> {
  const out: Record<string, DayRates> = {};
  for (const date of [...new Set(prices.map((p) => p.fxDate))].sort()) {
    const entry = fx.find((f) => f.date === date);
    if (!entry) throw new Error(`fx.json has no entry for ${date}`);
    const wanted = new Set<string>([
      ...DISPLAY_CURRENCIES.filter((c) => c !== "USD"),
      ...prices.filter((p) => p.fxDate === date && p.currency !== "USD").map((p) => p.currency),
    ]);
    const usdPer: Record<string, number> = {};
    for (const currency of [...wanted].sort()) {
      const rate = entry.usdPer[currency];
      if (rate === undefined) throw new Error(`fx.json ${date} has no ${currency} rate`);
      usdPer[currency] = rate;
    }
    out[date] = {
      usdPer,
      sourceTitle: entry.sourceTitle,
      sourceUrl: entry.sourceUrl,
      checkedOn: entry.checkedOn,
      licence: entry.licence,
      ...(entry.sample ? { sample: true } : {}),
    };
  }
  return out;
}

/** A priced item as the generator sees it. */
export function generatorPrice(
  priced: PricedItem,
  rates: Readonly<Record<string, Pick<DayRates, "usdPer">>>,
): GeneratorPrice {
  const dayRates = rates[priced.fxDate];
  if (!dayRates) throw new Error(`${priced.id}: no rates for ${priced.fxDate}`);
  return {
    id: priced.id,
    itemId: priced.itemId,
    country: priced.country,
    usd: usdPrice(priced, priced.item),
    usdPer: dayRates.usdPer,
  };
}

/** "p0042-03": puzzle 42, pair 3. */
export function pairId(puzzle: number, index: number): string {
  return `p${String(puzzle).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
}

/** The poll shown after daily puzzle `puzzle`: the questions take turns. */
export function pollFor(puzzle: number, polls: readonly Poll[]): Poll | undefined {
  return polls.length ? polls[(puzzle - 1) % polls.length] : undefined;
}

/** A generated day as the self-contained daily file. */
export function dailyPuzzle(
  day: GeneratedDay,
  priced: ReadonlyMap<string, PricedItem>,
  fx: readonly FxEntry[],
  polls: readonly Poll[],
): DailyPuzzle {
  const pairs: Pair[] = day.pairs.map((pair, index) => {
    const a = priced.get(pair.a);
    const b = priced.get(pair.b);
    if (!a || !b) throw new Error(`Puzzle ${day.puzzle}: unknown price in pair ${index + 1}`);
    return { id: pairId(day.puzzle, index), kind: pair.kind, a, b };
  });
  const prices = pairs.flatMap((p) => [p.a, p.b]);
  const rates = ratesFor(prices, fx);
  const poll = pollFor(day.puzzle, polls);
  const sample = prices.some((p) => p.sample) || Object.values(rates).some((r) => r.sample);
  return {
    puzzle: day.puzzle,
    pairs,
    rates,
    ...(poll ? { poll } : {}),
    ...(sample ? { sample: true } : {}),
  };
}

/** The Endless pool: every price except the excluded ones (scheduled in dailies soon). */
export function buildPool(catalog: Catalog, exclude: ReadonlySet<string>): Pool {
  const prices = catalog.prices
    .filter((p) => !exclude.has(p.id))
    .map((p) => pricedItem(p, catalog));
  const rates = ratesFor(prices, catalog.fx);
  const sample = prices.some((p) => p.sample) || Object.values(rates).some((r) => r.sample);
  return { prices, rates, ...(sample ? { sample: true } : {}) };
}
