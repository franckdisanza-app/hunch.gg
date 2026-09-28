// pnpm sticker-shock:sample
//
// Writes the development sample set for Sticker Shock: FAKE prices for every item in every
// country, all in one made-up store ("Sample Mart"), with made-up exchange rates and placeholder
// proof images watermarked SAMPLE. Every row is flagged sample: true, the game shows a "Sample
// data" banner while any of it is served, and CONTENT_MODE=production rejects it.
//
// Overwrites content/sticker-shock/prices.csv and fx.json: only run it while no real prices exist.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Country, Item } from "@/games/sticker-shock/content.schema";
import { roundMoney, type Unit } from "@/games/sticker-shock/pricing";
import { seededRandom } from "@/games/sticker-shock/random";
import { PRICE_COLUMNS, toCsv } from "./lib/prices-csv";

const { values } = parseArgs({ options: { force: { type: "boolean", default: false } } });

const root = process.cwd();
const dir = join(root, "content", "sticker-shock");
const csvFile = join(dir, "prices.csv");

if (existsSync(csvFile) && !values.force) {
  const csv = readFileSync(csvFile, "utf8");
  const rows = csv.trim().split(/\r?\n/).slice(1);
  if (rows.some((row) => !/,true$/.test(row.trim()))) {
    console.error("prices.csv has rows that are not samples. Refusing to overwrite (use --force).");
    process.exit(1);
  }
}

const items = JSON.parse(readFileSync(join(dir, "items.json"), "utf8")) as Item[];
const countries = JSON.parse(readFileSync(join(dir, "countries.json"), "utf8")) as Country[];

// Made-up round numbers: US dollars per unit. NOT real exchange rates.
const FAKE_USD_PER: Record<string, number> = {
  CHF: 1.2,
  EUR: 1.1,
  GBP: 1.3,
  SEK: 0.1,
  NOK: 0.1,
  DKK: 0.15,
  PLN: 0.25,
  CZK: 0.045,
  CAD: 0.75,
  MXN: 0.05,
  JPY: 0.007,
  KRW: 0.0007,
  AUD: 0.65,
  SGD: 0.75,
  ZAR: 0.055,
};
const SAMPLE_DATE = "2026-09-01";

// Made-up shelf-pack variations, so the sample set exercises scaling on the reveal.
const PACKS: Partial<Record<string, [number, Unit][]>> = {
  eggs: [
    [12, "pcs"],
    [10, "pcs"],
    [6, "pcs"],
  ],
  "olive-oil": [
    [1, "l"],
    [750, "ml"],
    [500, "ml"],
  ],
  coffee: [
    [250, "g"],
    [500, "g"],
  ],
  water: [
    [1.5, "l"],
    [1, "l"],
  ],
  chicken: [
    [1, "kg"],
    [500, "g"],
  ],
  beer: [
    [500, "ml"],
    [330, "ml"],
  ],
};

const random = seededRandom("sticker-shock:sample:v1");
const rows: Record<string, string>[] = [];

for (const country of countries) {
  // A made-up "price level" per country, so pairs land in every ratio band.
  const level = 0.55 + random() * 1.1;
  for (const item of items) {
    const base = 0.8 + random() * 5; // made-up US dollars for the item's quantity
    const usd = base * level * (0.85 + random() * 0.3);
    const packs = PACKS[item.id] ?? [[item.quantity, item.unit]];
    const [packQuantity, packUnit] = packs[Math.floor(random() * packs.length)]!;
    const scale = toBase(packQuantity, packUnit) / toBase(item.quantity, item.unit);
    const fxToUsd = country.currency === "USD" ? 1 : FAKE_USD_PER[country.currency];
    if (!fxToUsd) throw new Error(`No fake rate for ${country.currency}`);
    const priceLocal = roundMoney((usd * scale) / fxToUsd, country.currency);
    const id = `${country.code.toLowerCase()}-${item.id}-01`;
    rows.push({
      id,
      itemId: item.id,
      country: country.code,
      currency: country.currency,
      priceLocal: String(priceLocal),
      packQuantity: String(packQuantity),
      packUnit,
      fxToUsd: "",
      fxDate: SAMPLE_DATE,
      store: "Sample Mart",
      sourceUrl: `https://example.test/sample-mart/${id}`,
      proofImage: `/games/sticker-shock/sample-proofs/${item.id}.svg`,
      capturedOn: SAMPLE_DATE,
      licence: "own",
      regular: "true",
      taxIncluded: "true",
      notes: "Fake price for development. Not a real shelf price.",
      sample: "true",
    });
  }
}

function toBase(quantity: number, unit: Unit): number {
  return unit === "kg" || unit === "l" ? quantity * 1000 : quantity;
}

writeFileSync(csvFile, toCsv(PRICE_COLUMNS, rows));

const fx = [
  {
    date: SAMPLE_DATE,
    usdPer: Object.fromEntries(
      [...new Set(["CHF", "EUR", "GBP", ...countries.map((c) => c.currency)])]
        .filter((c) => c !== "USD")
        .sort()
        .map((c) => [c, FAKE_USD_PER[c]!]),
    ),
    sourceTitle: "Sample FX Desk (fake rates)",
    sourceUrl: "https://example.test/sample-fx",
    checkedOn: SAMPLE_DATE,
    licence: "Sample data, not real rates",
    sample: true,
  },
];
writeFileSync(join(dir, "fx.json"), `${JSON.stringify(fx, null, 2)}\n`);

// Placeholder proofs: one per item, clearly watermarked.
const proofDir = join(root, "public", "games", "sticker-shock", "sample-proofs");
mkdirSync(proofDir, { recursive: true });
for (const item of items) {
  writeFileSync(join(proofDir, `${item.id}.svg`), sampleProof(item));
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function sampleProof(item: Item): string {
  const label = escapeXml(`${item.quantity} ${item.unit} ${item.label}`.toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="Sample placeholder proof, not a real shelf">
<rect width="640" height="480" fill="#EDEAE3"/>
<rect x="40" y="60" width="560" height="360" fill="#FAF7F0" stroke="#1B1B1B" stroke-width="4"/>
<rect x="40" y="60" width="560" height="44" fill="#E4002B"/>
<text x="60" y="90" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF">SAMPLE MART (FAKE STORE)</text>
<text x="60" y="170" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#1B1B1B">${label}</text>
<text x="60" y="220" font-family="Arial, sans-serif" font-size="22" fill="#1B1B1B">Placeholder image for development.</text>
<text x="60" y="254" font-family="Arial, sans-serif" font-size="22" fill="#1B1B1B">Not a real price, not a real shelf.</text>
<g transform="translate(320 300) rotate(-18)">
<text text-anchor="middle" font-family="Arial, sans-serif" font-size="120" font-weight="900" fill="#E4002B" fill-opacity="0.35" stroke="#1B1B1B" stroke-opacity="0.35" stroke-width="2">SAMPLE</text>
</g>
</svg>
`;
}

console.log(
  `Wrote ${rows.length} FAKE sample prices to content/sticker-shock/prices.csv, fake rates to fx.json ` +
    `and ${items.length} placeholder proofs. Now run: pnpm sticker-shock:build`,
);
