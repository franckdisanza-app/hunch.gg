import { MAX_RATIO, MIN_RATIO, displayOrderAgrees, priceRatio, ratioInRange } from "./pricing";
import { randomInt, seededRandom, shuffle, type Random } from "./random";

// The pair generator. Daily files are built from a fixed seed by `pnpm sticker-shock:build`;
// Endless builds pairs in the browser with the same candidate rules.
//
// Every pair: two prices from two different countries, the pricier 5–40% dearer in US dollars,
// the same order in every display currency. Every day: 10 pairs (4 of the same item in two
// countries, 6 of different items), no price used again within 14 days, at least 6 countries,
// an item at most twice, the right answer on the left 3–7 times.

export interface GeneratorPrice {
  id: string;
  itemId: string;
  country: string;
  /** Scaled to the item's quantity, in US dollars at the capture rate. */
  usd: number;
  /** US dollars per unit of each currency on the price's capture date. */
  usdPer: Readonly<Record<string, number>>;
}

export type PairKind = "same" | "different";

export interface CandidatePair {
  a: GeneratorPrice;
  b: GeneratorPrice;
  kind: PairKind;
  ratio: number;
}

export interface GeneratedPair {
  /** Shown first (left or top). */
  a: string;
  b: string;
  kind: PairKind;
  ratio: number;
  /** 0 when `a` is the pricier one. */
  pricier: 0 | 1;
}

export interface GeneratedDay {
  puzzle: number;
  pairs: GeneratedPair[];
}

export interface DayRules {
  pairsPerDay: number;
  samePairsPerDay: number;
  /** A price is used at most once in any window of this many consecutive days. */
  noRepeatDays: number;
  minCountries: number;
  maxItemUsesPerDay: number;
  /** The same two prices are not paired again within this many days. */
  noPairRepeatDays: number;
  /** How many pairs per day have the pricier item first: [min, max]. */
  pricierFirst: readonly [number, number];
}

export const DEFAULT_RULES: DayRules = {
  pairsPerDay: 10,
  samePairsPerDay: 4,
  noRepeatDays: 14,
  minCountries: 6,
  maxItemUsesPerDay: 2,
  noPairRepeatDays: 120,
  pricierFirst: [3, 7],
};

/** The fixed seed for daily puzzles. Changing it reshuffles every unreleased day. */
export const DAILY_SEED = "sticker-shock:daily:v1";

/** Ratio bands, so each day mixes easy, medium and hard pairs. */
export const RATIO_BANDS = [
  [MIN_RATIO, 1.15],
  [1.15, 1.27],
  [1.27, MAX_RATIO],
] as const;
const BAND_PLAN = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];

export function ratioBand(ratio: number): number {
  const index = RATIO_BANDS.findIndex(([, hi]) => ratio < hi);
  return index === -1 ? RATIO_BANDS.length - 1 : index;
}

export class GeneratorError extends Error {}

/** Whether two prices can face each other: two countries, ratio 1.05–1.40, display agrees. */
export function candidate(a: GeneratorPrice, b: GeneratorPrice): CandidatePair | null {
  if (a.country === b.country || a.id === b.id) return null;
  const ratio = priceRatio(a.usd, b.usd);
  if (!ratioInRange(ratio)) return null;
  if (!displayOrderAgrees(a, b)) return null;
  return { a, b, kind: a.itemId === b.itemId ? "same" : "different", ratio };
}

/** Every valid pair among the prices, split by kind. Sorted by ID first, so order is stable. */
export function candidatePairs(
  prices: readonly GeneratorPrice[],
): Record<PairKind, CandidatePair[]> {
  const sorted = [...prices].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const out: Record<PairKind, CandidatePair[]> = { same: [], different: [] };
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const pair = candidate(sorted[i]!, sorted[j]!);
      if (pair) out[pair.kind].push(pair);
    }
  }
  return out;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Puts the pricier item first on some pairs and second on others, within the rules. */
function orient(random: Random, chosen: CandidatePair[], rules: DayRules): GeneratedPair[] {
  const pairs = chosen.map((pair): GeneratedPair => {
    const swap = random() < 0.5;
    const [a, b] = swap ? [pair.b, pair.a] : [pair.a, pair.b];
    return {
      a: a.id,
      b: b.id,
      kind: pair.kind,
      ratio: pair.ratio,
      pricier: a.usd >= b.usd ? 0 : 1,
    };
  });
  const [min, max] = rules.pricierFirst;
  let first = pairs.filter((p) => p.pricier === 0).length;
  while (first < min || first > max) {
    const want = first < min ? 1 : 0;
    const flippable = pairs.filter((p) => p.pricier === want);
    const pair = flippable[randomInt(random, flippable.length)]!;
    [pair.a, pair.b] = [pair.b, pair.a];
    pair.pricier = pair.pricier === 0 ? 1 : 0;
    first += want === 1 ? 1 : -1;
  }
  return pairs;
}

interface DayState {
  used: Set<string>;
  itemUses: Map<string, number>;
  countries: Set<string>;
}

function fits(pair: CandidatePair, day: DayState, blocked: ReadonlySet<string>, rules: DayRules) {
  const { a, b } = pair;
  if (blocked.has(a.id) || blocked.has(b.id) || day.used.has(a.id) || day.used.has(b.id))
    return false;
  const usesA = (day.itemUses.get(a.itemId) ?? 0) + 1;
  const usesB = (day.itemUses.get(b.itemId) ?? 0) + (a.itemId === b.itemId ? 2 : 1);
  return usesA <= rules.maxItemUsesPerDay && usesB <= rules.maxItemUsesPerDay;
}

/** Picks a fitting pair: random tries first (preferring the band), then a scan. */
function pickPair(
  random: Random,
  pool: readonly CandidatePair[],
  day: DayState,
  blocked: ReadonlySet<string>,
  band: number,
  rules: DayRules,
): CandidatePair | null {
  if (pool.length === 0) return null;
  for (let tries = 0; tries < 400; tries++) {
    const pair = pool[randomInt(random, pool.length)]!;
    if (ratioBand(pair.ratio) === band && fits(pair, day, blocked, rules)) return pair;
  }
  const start = randomInt(random, pool.length);
  for (let k = 0; k < pool.length; k++) {
    const pair = pool[(start + k) % pool.length]!;
    if (fits(pair, day, blocked, rules)) return pair;
  }
  return null;
}

function buildDay(
  random: Random,
  pools: Record<PairKind, CandidatePair[]>,
  blocked: ReadonlySet<string>,
  rules: DayRules,
): CandidatePair[] | null {
  const kinds: PairKind[] = shuffle(random, [
    ...Array<PairKind>(rules.samePairsPerDay).fill("same"),
    ...Array<PairKind>(rules.pairsPerDay - rules.samePairsPerDay).fill("different"),
  ]);
  const bands = shuffle(
    random,
    Array.from({ length: rules.pairsPerDay }, (_, i) => BAND_PLAN[i % BAND_PLAN.length]!),
  );
  const day: DayState = { used: new Set(), itemUses: new Map(), countries: new Set() };
  const chosen: CandidatePair[] = [];
  for (let slot = 0; slot < kinds.length; slot++) {
    const pair = pickPair(random, pools[kinds[slot]!], day, blocked, bands[slot]!, rules);
    if (!pair) return null;
    chosen.push(pair);
    for (const price of [pair.a, pair.b]) {
      day.used.add(price.id);
      day.itemUses.set(price.itemId, (day.itemUses.get(price.itemId) ?? 0) + 1);
      day.countries.add(price.country);
    }
  }
  return day.countries.size >= rules.minCountries ? chosen : null;
}

export interface GenerateDaysInput {
  prices: readonly GeneratorPrice[];
  seed?: string;
  /** First and last puzzle number to generate. */
  from: number;
  to: number;
  /** Price IDs of days that are fixed (already released), by puzzle number. */
  history?: ReadonlyMap<number, readonly GeneratedPair[] | readonly { a: string; b: string }[]>;
  rules?: Partial<DayRules>;
}

/** Generates daily puzzles `from`…`to`, one after the other, honouring the fixed history. */
export function generateDays(input: GenerateDaysInput): GeneratedDay[] {
  const rules = { ...DEFAULT_RULES, ...input.rules };
  const seed = input.seed ?? DAILY_SEED;
  const pools = candidatePairs(input.prices);
  const history = new Map<number, readonly { a: string; b: string }[]>(input.history ?? []);
  const days: GeneratedDay[] = [];

  for (let puzzle = input.from; puzzle <= input.to; puzzle++) {
    const blocked = new Set<string>();
    const recentPairs = new Set<string>();
    for (let back = 1; back < Math.max(rules.noRepeatDays, rules.noPairRepeatDays); back++) {
      for (const pair of history.get(puzzle - back) ?? []) {
        if (back < rules.noRepeatDays) {
          blocked.add(pair.a);
          blocked.add(pair.b);
        }
        recentPairs.add(pairKey(pair.a, pair.b));
      }
    }
    const pairPools: Record<PairKind, CandidatePair[]> = {
      same: pools.same.filter((p) => !recentPairs.has(pairKey(p.a.id, p.b.id))),
      different: pools.different.filter((p) => !recentPairs.has(pairKey(p.a.id, p.b.id))),
    };

    const random = seededRandom(`${seed}:${puzzle}`);
    let chosen: CandidatePair[] | null = null;
    for (let attempt = 0; attempt < 300 && !chosen; attempt++) {
      chosen = buildDay(random, pairPools, blocked, rules);
    }
    if (!chosen) {
      const open = (pool: CandidatePair[]) =>
        pool.filter((p) => !blocked.has(p.a.id) && !blocked.has(p.b.id)).length;
      throw new GeneratorError(
        `Could not build puzzle ${puzzle}: ${open(pairPools.same)} same-item and ` +
          `${open(pairPools.different)} different-item pairs are free after blocking ` +
          `${blocked.size} prices used in the last ${rules.noRepeatDays - 1} days. ` +
          `Add more prices (see docs/games/sticker-shock/data-guide.md).`,
      );
    }
    const pairs = orient(random, chosen, rules);
    history.set(puzzle, pairs);
    days.push({ puzzle, pairs });
  }
  return days;
}

/**
 * Endless: an unbounded stream of pairs, about 40% of the same item. Prices seen recently in the
 * run are skipped while there is anything else to show.
 */
export function createEndlessDeck(
  prices: readonly GeneratorPrice[],
  random: Random,
  options: { sameShare?: number; recent?: number } = {},
) {
  const sameShare = options.sameShare ?? DEFAULT_RULES.samePairsPerDay / DEFAULT_RULES.pairsPerDay;
  const pools = candidatePairs(prices);
  const recentLimit = options.recent ?? Math.min(40, Math.floor(prices.length / 3));
  const recent: string[] = [];

  function draw(pool: CandidatePair[]): CandidatePair | null {
    if (pool.length === 0) return null;
    for (let tries = 0; tries < 200; tries++) {
      const pair = pool[randomInt(random, pool.length)]!;
      if (!recent.includes(pair.a.id) && !recent.includes(pair.b.id)) return pair;
    }
    return pool[randomInt(random, pool.length)]!;
  }

  return {
    /** How many valid pairs exist, by kind. */
    size: { same: pools.same.length, different: pools.different.length },
    next(): GeneratedPair | null {
      const kind: PairKind = random() < sameShare ? "same" : "different";
      const other: PairKind = kind === "same" ? "different" : "same";
      const pair = draw(pools[kind]) ?? draw(pools[other]);
      if (!pair) return null;
      recent.push(pair.a.id, pair.b.id);
      while (recent.length > recentLimit) recent.shift();
      const swap = random() < 0.5;
      const [a, b] = swap ? [pair.b, pair.a] : [pair.a, pair.b];
      return {
        a: a.id,
        b: b.id,
        kind: pair.kind,
        ratio: pair.ratio,
        pricier: a.usd >= b.usd ? 0 : 1,
      };
    },
  };
}
