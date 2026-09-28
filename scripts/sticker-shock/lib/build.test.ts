import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeCatalog } from "@/games/sticker-shock/__fixtures__/fake-catalog";
import type { GameDefinition } from "@/games/types";
import { buildStickerShock, formatReport, pricesFromRows } from "./build";
import { PRICE_COLUMNS, toCsv } from "./prices-csv";

// A fake game launched on 2026-03-01; at NOW, puzzle 3 is the newest released one (UTC+14).
const NOW = new Date("2026-03-02T12:00:00Z");
const GAME: GameDefinition = {
  slug: "sticker-shock",
  name: "Sticker Shock",
  tagline: "Fake tagline for tests.",
  status: "hidden",
  launchDate: "2026-03-01",
  modes: ["daily", "unlimited"],
  engine: "choice",
  usesCrowdApi: [],
};

let root: string;
const dir = () => join(root, "content", "sticker-shock");
const daily = (n: number) => join(dir(), "daily", `${String(n).padStart(4, "0")}.json`);

function writeCatalog(catalog = fakeCatalog()) {
  mkdirSync(join(dir(), "daily"), { recursive: true });
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(join(root, "public", "fake-proof.svg"), "<svg/>");
  const json = (name: string, data: unknown) =>
    writeFileSync(join(dir(), name), JSON.stringify(data));
  json("items.json", catalog.items);
  json("countries.json", catalog.countries);
  json("fx.json", catalog.fx);
  json("polls.json", catalog.polls);
  writeFileSync(
    join(dir(), "csv-mapping.json"),
    readFileSync(join(process.cwd(), "content", "sticker-shock", "csv-mapping.json")),
  );
  const rows = catalog.prices.map((p) =>
    Object.fromEntries(
      PRICE_COLUMNS.map((c) => [c, c === "fxToUsd" ? "" : String(p[c as keyof typeof p] ?? "")]),
    ),
  );
  writeFileSync(join(dir(), "prices.csv"), toCsv(PRICE_COLUMNS, rows));
}

const build = (options: Partial<Parameters<typeof buildStickerShock>[0]> = {}) =>
  buildStickerShock({ root, game: GAME, now: NOW, days: 12, mode: "sample", ...options });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "plimp-sticker-shock-"));
  writeCatalog();
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("pnpm sticker-shock:build", () => {
  it("converts the CSV, generates daily files and reports on them", async () => {
    const result = await build();
    expect(result.errors).toEqual([]);
    const prices = JSON.parse(readFileSync(join(dir(), "prices.json"), "utf8"));
    expect(prices).toHaveLength(500);
    expect(prices[0].fxToUsd).toBeGreaterThan(0);
    expect(result.report?.written).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(result.report?.pairTypes).toEqual({ same: 60, different: 90 });
    const text = formatReport(result.report!);
    expect(text).toMatch(/Pair types \(150 pairs\)/);
    expect(text).toMatch(/Countries per day: min \d+/);
    expect(text).toMatch(/Repeats: closest reuse of a price after (1[4-9]|[2-9]\d) days|no price/);
  }, 60_000);

  it("never rewrites released puzzles", async () => {
    await build();
    const released = [1, 2, 3].map((n) => readFileSync(daily(n), "utf8"));
    const unreleased = readFileSync(daily(4), "utf8");
    // New data changes the future, not the past.
    writeCatalog(fakeCatalog({ seed: "other-fake-catalog" }));
    const result = await build();
    expect(result.report?.kept).toEqual([1, 2, 3]);
    expect([1, 2, 3].map((n) => readFileSync(daily(n), "utf8"))).toEqual(released);
    expect(readFileSync(daily(4), "utf8")).not.toEqual(unreleased);
  }, 60_000);

  it("regenerates everything with --reset", async () => {
    await build();
    const first = readFileSync(daily(1), "utf8");
    writeCatalog(fakeCatalog({ seed: "other-fake-catalog" }));
    const result = await build({ reset: true });
    expect(result.report?.kept).toEqual([]);
    expect(readFileSync(daily(1), "utf8")).not.toEqual(first);
  }, 60_000);

  it("refuses to fill a gap in released puzzles", async () => {
    await build();
    unlinkSync(daily(2));
    const result = await build();
    expect(result.errors).toEqual([expect.stringMatching(/0002\.json is released but missing/)]);
  }, 60_000);

  it("removes stale files past the new range and writes nothing on a dry run", async () => {
    await build({ days: 14 });
    const result = await build({ days: 12 });
    expect(result.report?.removed).toEqual(["0016.json", "0017.json"]);
    writeFileSync(daily(4), "{}");
    await build({ dryRun: true });
    expect(readFileSync(daily(4), "utf8")).toBe("{}");
  }, 60_000);

  it("stops on invalid prices before generating anything", async () => {
    const catalog = fakeCatalog();
    catalog.prices[0] = { ...catalog.prices[0]!, itemId: "fake-nothing" };
    writeCatalog(catalog);
    const result = await build();
    expect(result.errors).toEqual([expect.stringMatching(/unknown itemId/)]);
    expect(result.report).toBeNull();
  });
});

describe("pricesFromRows", () => {
  it("fills in the rate from fx.json and rejects promotions", () => {
    const { prices, fx } = fakeCatalog();
    const { fxToUsd: _drop, ...row } = prices[0]!;
    expect(pricesFromRows([row], fx)[0]!.fxToUsd).toBe(prices[0]!.fxToUsd);
    expect(() => pricesFromRows([{ ...row, regular: false }], fx)).toThrow(/regular/);
    expect(() => pricesFromRows([{ ...row, taxIncluded: false }], fx)).toThrow(/taxIncluded/);
  });
});
