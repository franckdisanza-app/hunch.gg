import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import * as z from "zod/mini";
import type { GameDefinition } from "@/games/types";
import { dailyPuzzle, generatorPrice, pricedItem, ratesFor } from "@/games/sticker-shock/catalog";
import {
  checkStickerShock,
  contentSpec,
  countriesFileSchema,
  dailyPuzzleSchema,
  fxFileSchema,
  itemsFileSchema,
  pollsFileSchema,
  pricesFileSchema,
  type Country,
  type DailyPuzzle,
  type FxEntry,
  type Item,
  type Poll,
  type Price,
  type PricedItem,
} from "@/games/sticker-shock/content.schema";
import {
  DAILY_SEED,
  RATIO_BANDS,
  generateDays,
  type DayRules,
  type GeneratedDay,
} from "@/games/sticker-shock/generator";
import { usdPrice, priceRatio } from "@/games/sticker-shock/pricing";
import { validateContent, type ContentMode } from "@/lib/content/validate";
import { latestPuzzleNumber, puzzleFileName } from "@/lib/daily";
import { readPricesCsv } from "./prices-csv";

// The logic behind `pnpm sticker-shock:build`:
//   1. prices.csv → prices.json (fxToUsd filled in from fx.json when the cell is empty)
//   2. validation of items, countries, prices, fx and polls, and their cross-file rules
//   3. daily files for the next N days from a fixed seed. Released puzzles (up to today's number
//      in UTC+14) are never rewritten: players may have played them and the CDN caches them.
//   4. full content validation and a report

export interface BuildOptions {
  root: string;
  game: GameDefinition;
  now: Date;
  /** Days of daily puzzles to have after today's, e.g. 365. */
  days: number;
  /** Regenerate released puzzles too. Only before launch, while nobody has played them. */
  reset?: boolean;
  dryRun?: boolean;
  mode: ContentMode;
  seed?: string;
  rules?: Partial<DayRules>;
}

export interface BuildReport {
  prices: number;
  samplePrices: number;
  items: number;
  countries: number;
  kept: number[];
  written: number[];
  removed: string[];
  pairTypes: { same: number; different: number };
  ratioBands: number[];
  ratioHistogram: { from: number; count: number }[];
  countriesPerDay: { min: number; avg: number; max: number };
  closestReuse: number | null;
  pricierFirst: { min: number; max: number; avg: number };
  unusedPrices: number;
}

export interface BuildResult {
  errors: string[];
  warnings: string[];
  report: BuildReport | null;
}

function readJson<T>(file: string, schema: z.ZodMiniType<T>): T {
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  const result = z.safeParse(schema, data);
  if (!result.success) throw new Error(`${file}: ${z.prettifyError(result.error)}`);
  return result.data;
}

function writeJson(file: string, data: unknown) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Fills empty fxToUsd cells from fx.json, then validates every row. */
export function pricesFromRows(rows: Record<string, unknown>[], fx: readonly FxEntry[]): Price[] {
  const filled = rows.map((row) => {
    if (row.fxToUsd !== undefined) return row;
    const currency = String(row.currency);
    const rate = currency === "USD" ? 1 : fx.find((f) => f.date === row.fxDate)?.usdPer[currency];
    return rate === undefined ? row : { ...row, fxToUsd: rate };
  });
  const result = z.safeParse(pricesFileSchema, filled);
  if (!result.success) throw new Error(`prices.csv: ${z.prettifyError(result.error)}`);
  return [...result.data].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function dailyNumbers(dir: string): number[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d{4}\.json$/.test(name))
    .map((name) => Number(name.slice(0, 4)))
    .sort((a, b) => a - b);
}

/** Embedded records drop editor notes: players never see them. */
function forPlayers(priced: PricedItem): PricedItem {
  const { notes: _notes, ...rest } = priced;
  return rest;
}

export async function buildStickerShock(options: BuildOptions): Promise<BuildResult> {
  const { root, game, now, days } = options;
  const dir = join(root, "content", game.slug);
  const dailyDir = join(dir, "daily");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!game.launchDate) {
    return { errors: [`${game.slug} has no launchDate in the registry`], warnings, report: null };
  }

  // 1. CSV → prices.json
  let items: Item[], countries: Country[], fx: FxEntry[], polls: Poll[], prices: Price[];
  try {
    items = readJson(join(dir, "items.json"), itemsFileSchema);
    countries = readJson(join(dir, "countries.json"), countriesFileSchema);
    fx = readJson(join(dir, "fx.json"), fxFileSchema);
    polls = readJson(join(dir, "polls.json"), pollsFileSchema);
    prices = pricesFromRows(
      readPricesCsv(join(dir, "prices.csv"), join(dir, "csv-mapping.json")),
      fx,
    );
  } catch (error) {
    return { errors: [(error as Error).message], warnings, report: null };
  }
  if (!options.dryRun) writeJson(join(dir, "prices.json"), prices);

  // 2. Cross-file rules, before generating anything.
  const precheck = checkStickerShock({
    mode: options.mode,
    files: {
      "items.json": items,
      "countries.json": countries,
      "prices.json": prices,
      "fx.json": fx,
      "polls.json": polls,
    },
    daily: new Map(),
    fileExists: (path) => existsSync(join(root, path)),
  });
  warnings.push(...precheck.warnings);
  if (precheck.errors.length) return { errors: precheck.errors, warnings, report: null };

  // 3. Daily files.
  const catalog = { items, countries, prices, fx };
  const priced = new Map(prices.map((p) => [p.id, forPlayers(pricedItem(p, catalog))]));
  const rates = ratesFor(prices, fx);
  const generatorPrices = [...priced.values()].map((p) => generatorPrice(p, rates));

  const latest = latestPuzzleNumber(game.launchDate, now);
  const existing = dailyNumbers(dailyDir);
  const existingSet = new Set(existing);
  const kept: number[] = [];
  const history = new Map<number, { a: string; b: string }[]>();
  let from = 1;
  if (!options.reset) {
    for (let n = 1; n <= latest; n++) {
      if (!existingSet.has(n)) {
        const later = existing.find((m) => m > n && m <= latest);
        if (later !== undefined) {
          errors.push(
            `daily/${puzzleFileName(n)} is released but missing while ${puzzleFileName(later)} exists. Restore it from git.`,
          );
          return { errors, warnings, report: null };
        }
        break;
      }
      const day = readJson(join(dailyDir, puzzleFileName(n)), dailyPuzzleSchema);
      history.set(
        n,
        day.pairs.map((p) => ({ a: p.a.id, b: p.b.id })),
      );
      kept.push(n);
    }
    from = kept.length + 1;
  }
  const to = Math.max(latest, 0) + days;

  let generated: GeneratedDay[];
  try {
    generated = generateDays({
      prices: generatorPrices,
      seed: options.seed ?? DAILY_SEED,
      from,
      to,
      history,
      ...(options.rules ? { rules: options.rules } : {}),
    });
  } catch (error) {
    return { errors: [(error as Error).message], warnings, report: null };
  }
  const puzzles = generated.map((day) => dailyPuzzle(day, priced, fx, polls));

  const removed: string[] = [];
  if (!options.dryRun) {
    mkdirSync(dailyDir, { recursive: true });
    for (const puzzle of puzzles) writeJson(join(dailyDir, puzzleFileName(puzzle.puzzle)), puzzle);
    for (const n of existing) {
      if (n > to) {
        unlinkSync(join(dailyDir, puzzleFileName(n)));
        removed.push(puzzleFileName(n));
      }
    }
  }

  // 4. Everything, the way `pnpm content:validate` sees it.
  if (!options.dryRun) {
    const validation = await validateContent({
      root,
      games: [game],
      now,
      mode: options.mode,
      loadSpec: async () => contentSpec as never,
    });
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
  }

  const keptPuzzles = kept.map((n) =>
    readJson(join(dailyDir, puzzleFileName(n)), dailyPuzzleSchema),
  );
  const report = buildReport([...keptPuzzles, ...puzzles], prices, items, countries, kept, removed);
  return { errors, warnings, report: { ...report, written: puzzles.map((p) => p.puzzle) } };
}

function buildReport(
  puzzles: readonly DailyPuzzle[],
  prices: readonly Price[],
  items: readonly Item[],
  countries: readonly Country[],
  kept: number[],
  removed: string[],
): BuildReport {
  const pairs = puzzles.flatMap((p) => p.pairs);
  const ratios = pairs.map((pair) =>
    priceRatio(usdPrice(pair.a, pair.a.item), usdPrice(pair.b, pair.b.item)),
  );
  const ratioBands = RATIO_BANDS.map(
    ([lo, hi], i) =>
      ratios.filter((r) => r >= lo && (i === RATIO_BANDS.length - 1 ? r <= hi + 1e-9 : r < hi))
        .length,
  );
  const ratioHistogram = Array.from({ length: 7 }, (_, i) => {
    const lo = 1.05 + i * 0.05;
    return {
      from: Math.round(lo * 100) / 100,
      count: ratios.filter(
        (r) => r >= lo - 1e-9 && (i === 6 ? r <= 1.4 + 1e-9 : r < lo + 0.05 - 1e-9),
      ).length,
    };
  });
  const countriesPerDay = puzzles.map(
    (p) => new Set(p.pairs.flatMap((pair) => [pair.a.country, pair.b.country])).size,
  );
  const lastSeen = new Map<string, number>();
  let closestReuse: number | null = null;
  for (const puzzle of [...puzzles].sort((a, b) => a.puzzle - b.puzzle)) {
    for (const pair of puzzle.pairs) {
      for (const id of [pair.a.id, pair.b.id]) {
        const last = lastSeen.get(id);
        if (last !== undefined) {
          const gap = puzzle.puzzle - last;
          closestReuse = closestReuse === null ? gap : Math.min(closestReuse, gap);
        }
        lastSeen.set(id, puzzle.puzzle);
      }
    }
  }
  const pricierFirst = puzzles.map(
    (p) =>
      p.pairs.filter((pair) => usdPrice(pair.a, pair.a.item) >= usdPrice(pair.b, pair.b.item))
        .length,
  );
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return {
    prices: prices.length,
    samplePrices: prices.filter((p) => p.sample).length,
    items: items.length,
    countries: countries.length,
    kept,
    written: [],
    removed,
    pairTypes: {
      same: pairs.filter((p) => p.kind === "same").length,
      different: pairs.filter((p) => p.kind === "different").length,
    },
    ratioBands,
    ratioHistogram,
    countriesPerDay: {
      min: Math.min(...countriesPerDay),
      avg: avg(countriesPerDay),
      max: Math.max(...countriesPerDay),
    },
    closestReuse,
    pricierFirst: {
      min: Math.min(...pricierFirst),
      max: Math.max(...pricierFirst),
      avg: avg(pricierFirst),
    },
    unusedPrices: prices.filter((p) => !lastSeen.has(p.id)).length,
  };
}

function bar(fraction: number, width = 30): string {
  return "█".repeat(Math.round(fraction * width)).padEnd(width, "·");
}

const pct = (n: number, total: number) => `${total ? Math.round((n / total) * 100) : 0}%`;

export function formatReport(report: BuildReport): string {
  const pairs = report.pairTypes.same + report.pairTypes.different;
  const range = (xs: number[]) => (xs.length ? `${xs[0]}–${xs[xs.length - 1]}` : "none");
  const lines = [
    `Prices: ${report.prices} (${report.samplePrices} sample) · ${report.items} items · ${report.countries} countries`,
    `Daily puzzles: kept ${range(report.kept)} (released), wrote ${range(report.written)}` +
      (report.removed.length ? `, removed ${report.removed.length} stale files` : ""),
    "",
    `Pair types (${pairs} pairs):`,
    `  same item, two countries  ${String(report.pairTypes.same).padStart(5)}  ${pct(report.pairTypes.same, pairs)}`,
    `  different items           ${String(report.pairTypes.different).padStart(5)}  ${pct(report.pairTypes.different, pairs)}`,
    "",
    "Price ratio (pricier / cheaper, in US dollars):",
    ...report.ratioHistogram.map(
      (b) =>
        `  ${b.from.toFixed(2)}–${(b.from + 0.05).toFixed(2)}  ${bar(pairs ? b.count / pairs : 0)} ${String(b.count).padStart(5)}  ${pct(b.count, pairs)}`,
    ),
    `  bands easy/medium/hard (1.27+ / 1.15–1.27 / below 1.15): ` +
      `${pct(report.ratioBands[2] ?? 0, pairs)} / ${pct(report.ratioBands[1] ?? 0, pairs)} / ${pct(report.ratioBands[0] ?? 0, pairs)}`,
    "",
    `Countries per day: min ${report.countriesPerDay.min}, avg ${report.countriesPerDay.avg.toFixed(1)}, max ${report.countriesPerDay.max}`,
    `Repeats: ${report.closestReuse === null ? "no price is used twice" : `closest reuse of a price after ${report.closestReuse} days`}`,
    `Pricier item first: ${report.pricierFirst.min}–${report.pricierFirst.max} per day (avg ${report.pricierFirst.avg.toFixed(1)})`,
    `Prices never used: ${report.unusedPrices}`,
  ];
  return lines.join("\n");
}
