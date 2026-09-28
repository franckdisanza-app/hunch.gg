import { fakeCatalog } from "./__fixtures__/fake-catalog";
import { generatorPrice, pricedItem, ratesFor } from "./catalog";
import {
  DEFAULT_RULES,
  GeneratorError,
  candidate,
  createEndlessDeck,
  generateDays,
  type GeneratedDay,
  type GeneratorPrice,
} from "./generator";
import { ratioInRange } from "./pricing";
import { seededRandom } from "./random";

function fakePrices(options?: Parameters<typeof fakeCatalog>[0]): GeneratorPrice[] {
  const catalog = fakeCatalog(options);
  const rates = ratesFor(catalog.prices, catalog.fx);
  return catalog.prices.map((p) => generatorPrice(pricedItem(p, catalog), rates));
}

const prices = fakePrices();
const byId = new Map(prices.map((p) => [p.id, p]));
const days = generateDays({ prices, from: 1, to: 40 });

describe("candidate pairs", () => {
  const usdPer = { CHF: 1.25, EUR: 1.1, GBP: 1.3 };
  const price = (id: string, country: string, usd: number, itemId = "fake-item") => ({
    id,
    itemId,
    country,
    usd,
    usdPer,
  });

  it("needs two countries and a ratio of 1.05–1.40", () => {
    expect(candidate(price("a", "XA", 10), price("b", "XA", 11))).toBeNull();
    expect(candidate(price("a", "XA", 10), price("b", "XB", 10.2))).toBeNull();
    expect(candidate(price("a", "XA", 10), price("b", "XB", 15))).toBeNull();
    expect(candidate(price("a", "XA", 10), price("b", "XB", 12))).toMatchObject({
      kind: "same",
    });
    expect(candidate(price("a", "XA", 10), price("b", "XB", 12, "other"))).toMatchObject({
      kind: "different",
    });
  });
});

describe("daily generator", () => {
  it("builds 10 pairs a day, 4 of them the same item", () => {
    expect(days).toHaveLength(40);
    for (const day of days) {
      expect(day.pairs).toHaveLength(DEFAULT_RULES.pairsPerDay);
      expect(day.pairs.filter((p) => p.kind === "same")).toHaveLength(4);
    }
  });

  it("keeps every pair between 1.05 and 1.40 and in two countries", () => {
    for (const pair of days.flatMap((d) => d.pairs)) {
      const a = byId.get(pair.a)!;
      const b = byId.get(pair.b)!;
      expect(ratioInRange(Math.max(a.usd, b.usd) / Math.min(a.usd, b.usd))).toBe(true);
      expect(a.country).not.toBe(b.country);
      expect(pair.kind === "same").toBe(a.itemId === b.itemId);
      expect(pair.pricier).toBe(a.usd >= b.usd ? 0 : 1);
    }
  });

  it("uses at least 6 countries a day and an item at most twice", () => {
    for (const day of days) {
      const used = day.pairs.flatMap((p) => [byId.get(p.a)!, byId.get(p.b)!]);
      expect(new Set(used.map((p) => p.country)).size).toBeGreaterThanOrEqual(6);
      const perItem = new Map<string, number>();
      for (const p of used) perItem.set(p.itemId, (perItem.get(p.itemId) ?? 0) + 1);
      expect(Math.max(...perItem.values())).toBeLessThanOrEqual(2);
    }
  });

  it("never repeats a price within 14 days", () => {
    const last = new Map<string, number>();
    for (const day of days) {
      for (const id of day.pairs.flatMap((p) => [p.a, p.b])) {
        const seen = last.get(id);
        if (seen !== undefined) expect(day.puzzle - seen).toBeGreaterThanOrEqual(14);
        last.set(id, day.puzzle);
      }
    }
  });

  it("puts the pricier item first 3 to 7 times a day", () => {
    for (const day of days) {
      const first = day.pairs.filter((p) => p.pricier === 0).length;
      expect(first).toBeGreaterThanOrEqual(3);
      expect(first).toBeLessThanOrEqual(7);
    }
  });

  it("is reproducible from the seed", () => {
    expect(generateDays({ prices, from: 1, to: 5 })).toEqual(days.slice(0, 5));
    expect(generateDays({ prices, from: 1, to: 5, seed: "other" })).not.toEqual(days.slice(0, 5));
  });

  it("does not depend on the order of the prices", () => {
    expect(generateDays({ prices: [...prices].reverse(), from: 1, to: 3 })).toEqual(
      days.slice(0, 3),
    );
  });

  it("continues after released days without reusing their prices", () => {
    const history = new Map<number, GeneratedDay["pairs"]>(
      days.slice(0, 10).map((d) => [d.puzzle, d.pairs]),
    );
    const next = generateDays({ prices, from: 11, to: 14, history });
    const recent = new Set(days.slice(0, 10).flatMap((d) => d.pairs.flatMap((p) => [p.a, p.b])));
    for (const day of next) {
      for (const id of day.pairs.flatMap((p) => [p.a, p.b])) expect(recent.has(id)).toBe(false);
    }
  });

  it("explains when there are not enough prices", () => {
    const few = fakePrices({ countries: 6, items: 10 });
    expect(() => generateDays({ prices: few, from: 1, to: 14 })).toThrow(GeneratorError);
    expect(() => generateDays({ prices: few, from: 1, to: 14 })).toThrow(/Add more prices/);
  });
});

describe("Endless deck", () => {
  it("draws valid pairs, about 40% of the same item", () => {
    const deck = createEndlessDeck(prices, seededRandom("fake-endless"));
    const pairs = Array.from({ length: 1000 }, () => deck.next()!);
    const same = pairs.filter((p) => p.kind === "same").length / pairs.length;
    expect(same).toBeGreaterThan(0.33);
    expect(same).toBeLessThan(0.47);
    for (const pair of pairs) {
      const a = byId.get(pair.a)!;
      const b = byId.get(pair.b)!;
      expect(ratioInRange(Math.max(a.usd, b.usd) / Math.min(a.usd, b.usd))).toBe(true);
    }
  });

  it("avoids prices it showed recently", () => {
    const deck = createEndlessDeck(prices, seededRandom("fake-recent"), { recent: 20 });
    const ids = Array.from({ length: 10 }, () => deck.next()!).flatMap((p) => [p.a, p.b]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns null when nothing can be paired", () => {
    const deck = createEndlessDeck(prices.slice(0, 1), seededRandom("fake-empty"));
    expect(deck.next()).toBeNull();
  });
});
