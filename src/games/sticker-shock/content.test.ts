import { existsSync } from "node:fs";
import { join } from "node:path";
import { getGame } from "@/games/registry";
import { validateContent } from "@/lib/content/validate";
import { fakeCatalog } from "./__fixtures__/fake-catalog";
import { buildPool, dailyPuzzle, generatorPrice, pricedItem, ratesFor } from "./catalog";
import {
  checkStickerShock,
  contentSpec,
  priceFact,
  type DailyPuzzle,
  type Price,
} from "./content.schema";
import { generateDays } from "./generator";

// The fake catalog, as the content check sees it.
function context(overrides: { prices?: Price[]; daily?: Map<number, DailyPuzzle> } = {}) {
  const catalog = fakeCatalog();
  return {
    mode: "sample" as const,
    files: {
      "items.json": catalog.items,
      "countries.json": catalog.countries,
      "prices.json": overrides.prices ?? catalog.prices,
      "fx.json": catalog.fx,
      "polls.json": catalog.polls,
    },
    daily: overrides.daily ?? new Map<number, DailyPuzzle>(),
    fileExists: (path: string) => path === "public/fake-proof.svg",
  };
}

function fakeDays(count: number): Map<number, DailyPuzzle> {
  const catalog = fakeCatalog();
  const rates = ratesFor(catalog.prices, catalog.fx);
  const priced = new Map(catalog.prices.map((p) => [p.id, pricedItem(p, catalog)]));
  const days = generateDays({
    prices: [...priced.values()].map((p) => generatorPrice(p, rates)),
    from: 1,
    to: count,
  });
  return new Map(days.map((d) => [d.puzzle, dailyPuzzle(d, priced, catalog.fx, catalog.polls)]));
}

describe("the content check", () => {
  it("passes a consistent catalog and its generated days", () => {
    expect(checkStickerShock(context({ daily: fakeDays(15) }))).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("rejects unknown items and countries, and the wrong currency", () => {
    const [first, second, third] = fakeCatalog().prices;
    const { errors } = checkStickerShock(
      context({
        prices: [
          { ...first!, itemId: "fake-nothing" },
          { ...second!, country: "XZ" },
          { ...third!, currency: "XQZ" },
        ],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unknown itemId "fake-nothing"/),
        expect.stringMatching(/unknown country "XZ"/),
        expect.stringMatching(/uses XQA, not XQZ/),
      ]),
    );
  });

  it("rejects a rate that differs from fx.json or comes after the capture", () => {
    const [first, second] = fakeCatalog().prices;
    const { errors } = checkStickerShock(
      context({
        prices: [
          { ...first!, fxToUsd: first!.fxToUsd * 1.01 },
          { ...second!, capturedOn: "2026-01-01" },
        ],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/differs from fx\.json/),
        expect.stringMatching(/fx\.json has no entry|after the capture/),
      ]),
    );
  });

  it("rejects packs that cannot be scaled, duplicates and missing proofs", () => {
    const [first] = fakeCatalog().prices;
    const { errors } = checkStickerShock(
      context({
        prices: [
          { ...first!, packUnit: first!.packUnit === "pcs" ? "kg" : "pcs" },
          { ...first!, proofImage: "/fake-missing.svg" },
        ],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/cannot be scaled/),
        expect.stringMatching(/duplicate id/),
        expect.stringMatching(/public\/fake-missing\.svg is missing/),
      ]),
    );
  });

  it("rejects sample proofs in production", () => {
    const [first] = fakeCatalog().prices;
    const proof = "/games/sticker-shock/sample-proofs/fake.svg";
    const ctx = {
      ...context({ prices: [{ ...first!, proofImage: proof }] }),
      fileExists: () => true,
    };
    expect(checkStickerShock(ctx).errors).toEqual([]);
    expect(checkStickerShock({ ...ctx, mode: "production" }).errors).toEqual([
      expect.stringMatching(/still uses a sample proof image/),
    ]);
  });

  it("rejects a price reused within 14 days and a day with too few countries", () => {
    const days = fakeDays(3);
    const day1 = days.get(1)!;
    const day3 = days.get(3)!;
    day3.pairs[0] = day1.pairs[0]!;
    const narrow: DailyPuzzle = {
      ...day1,
      puzzle: 20,
      // Only three countries all day, never the same one twice in a pair.
      pairs: day1.pairs.map((p, i) => ({
        ...p,
        a: { ...p.a, country: ["XA", "XB", "XC"][i % 3]! },
        b: { ...p.b, country: ["XB", "XC", "XA"][i % 3]! },
      })),
    };
    days.set(20, narrow);
    const { errors } = checkStickerShock(context({ daily: days }));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/repeats after 2 days/),
        expect.stringMatching(/daily\/0020\.json: uses \d countries, at least 6 needed/),
      ]),
    );
  });

  it("rejects a pair whose kind or ratio is wrong", () => {
    const days = fakeDays(1);
    const day = days.get(1)!;
    const pair = day.pairs[0]!;
    day.pairs[0] = {
      ...pair,
      kind: pair.kind === "same" ? "different" : "same",
      b: { ...pair.b, priceLocal: pair.b.priceLocal * 3 },
    };
    const { errors } = checkStickerShock(context({ daily: days }));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/does not match its items/),
        expect.stringMatching(/price ratio .* is outside 1\.05–1\.4/),
      ]),
    );
  });
});

describe("prices as facts", () => {
  it("cite the store, the capture date and the licence", () => {
    const [price] = fakeCatalog().prices;
    expect(priceFact(price!)).toMatchObject({
      sourceTitle: "Fake Mart",
      checkedOn: price!.capturedOn,
      licence: "Own screenshot",
    });
    expect(priceFact({ ...price!, licence: "ODbL" }).sourceTitle).toBe("Fake Mart (Open Prices)");
  });
});

describe("the Endless pool", () => {
  it("leaves out excluded prices and carries the rates they need", () => {
    const catalog = fakeCatalog();
    const exclude = new Set(catalog.prices.slice(0, 5).map((p) => p.id));
    const pool = buildPool(catalog, exclude);
    expect(pool.prices).toHaveLength(catalog.prices.length - 5);
    expect(pool.prices.some((p) => exclude.has(p.id))).toBe(false);
    expect(Object.keys(pool.rates)).toEqual([catalog.fx[0]!.date]);
    expect(pool.sample).toBe(true);
  });
});

describe("content/sticker-shock in the repository", () => {
  const root = process.cwd();
  const game = getGame("sticker-shock")!;
  const run = (mode: "sample" | "production") =>
    validateContent({
      root,
      games: [game],
      now: new Date(),
      mode,
      loadSpec: async () => contentSpec as never,
    });

  it.runIf(existsSync(join(root, "content", "sticker-shock", "prices.json")))(
    "is valid sample content, and is refused in production while samples remain",
    async () => {
      expect((await run("sample")).errors).toEqual([]);
      const production = await run("production");
      expect(production.errors.some((e) => e.includes("sample: true"))).toBe(true);
      expect(production.errors.some((e) => e.includes("sample proof image"))).toBe(true);
    },
    60_000,
  );
});
