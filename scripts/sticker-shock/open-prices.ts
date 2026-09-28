// pnpm sticker-shock:open-prices [--since 2026-01-01] [--items bananas,apples] [--pages 3]
//
// Pulls candidate prices from the Open Prices API (prices.openfoodfacts.org, ODbL) for the items
// in content/sticker-shock/open-prices-map.json and the countries in countries.json, and writes
// them to content/sticker-shock/review/open-prices-<date>.csv for a person to check. It never
// touches prices.csv: copy the rows you have checked, fill in regular, taxIncluded and the rate,
// save the proof (after checking its licence) and run pnpm sticker-shock:proofs.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import * as z from "zod/mini";
import { countriesFileSchema, itemsFileSchema } from "@/games/sticker-shock/content.schema";
import {
  OPEN_PRICES,
  REVIEW_COLUMNS,
  candidateRow,
  openPricesMapSchema,
  openPricesPageSchema,
} from "./lib/open-prices";
import { toCsv } from "./lib/prices-csv";

const { values } = parseArgs({
  options: {
    since: { type: "string" },
    items: { type: "string" },
    pages: { type: "string", default: "3" },
  },
});

const dir = join(process.cwd(), "content", "sticker-shock");
const read = <T>(file: string, schema: z.ZodMiniType<T>) =>
  z.parse(schema, JSON.parse(readFileSync(join(dir, file), "utf8")));
const items = read("items.json", itemsFileSchema);
const countries = read("countries.json", countriesFileSchema);
const map = read("open-prices-map.json", openPricesMapSchema);

const wanted = values.items ? values.items.split(",").map((s) => s.trim()) : Object.keys(map);
const since = values.since ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
const pages = Math.max(1, Number(values.pages));
const HEADERS = { "User-Agent": "Plimp Sticker Shock data review (https://plimp.lol)" };

const rows: Record<string, string>[] = [];
for (const itemId of wanted) {
  const item = items.find((i) => i.id === itemId);
  const entry = map[itemId];
  if (!item || !entry) {
    console.warn(`skip     ${itemId}: not in items.json or open-prices-map.json`);
    continue;
  }
  let found = 0;
  for (let page = 1; page <= pages; page++) {
    const query = new URLSearchParams({
      category_tag: entry.category_tag,
      price_is_discounted: "false",
      date__gte: since,
      order_by: "-date",
      page: String(page),
      size: "100",
    });
    const res = await fetch(`${OPEN_PRICES}/api/v1/prices?${query}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Open Prices answered ${res.status} for ${itemId}`);
    const data = z.parse(openPricesPageSchema, await res.json());
    for (const price of data.items) {
      const row = candidateRow(price, item, entry, countries);
      if (row) {
        rows.push(row);
        found++;
      }
    }
    if (page >= data.pages) break;
    // Be gentle with a free, volunteer-run service.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log(`${itemId.padEnd(14)} ${found} candidates`);
}

const reviewDir = join(dir, "review");
mkdirSync(reviewDir, { recursive: true });
const out = join(reviewDir, `open-prices-${new Date().toISOString().slice(0, 10)}.csv`);
writeFileSync(out, toCsv(REVIEW_COLUMNS, rows));
console.log(
  `\n${rows.length} candidates written to ${out}.\n` +
    "Data from Open Prices by Open Food Facts contributors, under the Open Database License (ODbL).\n" +
    "Nothing was published: review each row before copying it into prices.csv.",
);
