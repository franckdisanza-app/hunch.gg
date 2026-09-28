import { buildShareText } from "@/lib/share";
import { fakeCatalog } from "./__fixtures__/fake-catalog";
import { dailyPuzzle, generatorPrice, pricedItem, ratesFor } from "./catalog";
import type { PricedItem } from "./content.schema";
import { generateDays } from "./generator";
import { dailyShare, endlessShare, teaserPair } from "./share";
import {
  announcement,
  costVerb,
  itemPhrase,
  itemTitle,
  localPriceText,
  receiptItem,
  receiptLine,
  teaser,
  turnsOutSentence,
} from "./text";

// Everything here is fake: Fakeland countries, made-up items and prices.

const base = fakeCatalog().prices[0]!;
function priced(overrides: {
  item: PricedItem["item"];
  usd: number;
  country?: string;
  countryName?: string;
  countryInSentence?: string;
  pack?: [number, PricedItem["packUnit"]];
}): PricedItem {
  const [packQuantity, packUnit] = overrides.pack ?? [overrides.item.quantity, overrides.item.unit];
  const scale =
    ((overrides.item.unit === "kg" || overrides.item.unit === "l" ? 1000 : 1) *
      overrides.item.quantity) /
    ((packUnit === "kg" || packUnit === "l" ? 1000 : 1) * packQuantity);
  return {
    ...base,
    id: `${overrides.country ?? "xa"}-${overrides.item.id}`.toLowerCase(),
    itemId: overrides.item.id,
    country: overrides.country ?? "XA",
    currency: "USD",
    fxToUsd: 1,
    priceLocal: overrides.usd / scale,
    packQuantity,
    packUnit,
    item: overrides.item,
    countryName: overrides.countryName ?? "Fakeland A",
    ...(overrides.countryInSentence ? { countryInSentence: overrides.countryInSentence } : {}),
  };
}

const eggs = {
  id: "fake-eggs",
  label: "fake eggs",
  quantity: 12,
  unit: "pcs" as const,
  receipt: "FAKE EGGS",
  icon: "eggs",
  category: "dairy" as const,
};
const fruit = {
  ...eggs,
  id: "fake-fruit",
  label: "fake fruit",
  quantity: 1,
  unit: "kg" as const,
  receipt: "FAKE FRUIT",
};
const water = {
  ...eggs,
  id: "fake-water",
  label: "fake water",
  quantity: 1.5,
  unit: "l" as const,
  receipt: "FAKE WATER",
};

describe("labels", () => {
  it("writes quantities the way shelves do", () => {
    expect(itemTitle(eggs)).toBe("12 fake eggs");
    expect(itemTitle(fruit)).toBe("1 kg fake fruit");
    expect(itemTitle(water)).toBe("1.5 L fake water");
    expect(itemPhrase(fruit)).toBe("1 kg of fake fruit");
    expect(itemPhrase(eggs)).toBe("12 fake eggs");
  });

  it("agrees the verb with the quantity", () => {
    expect(costVerb(eggs)).toBe("cost");
    expect(costVerb(fruit)).toBe("costs");
    expect(costVerb({ quantity: 1, unit: "pcs" })).toBe("costs");
  });

  it("abbreviates for the receipt", () => {
    expect(receiptItem(eggs)).toBe("12 FAKE EGGS");
    expect(receiptItem(fruit)).toBe("1KG FAKE FRUIT");
    expect(receiptItem(water)).toBe("1.5L FAKE WATER");
    const a = priced({ item: eggs, usd: 3, country: "XA" });
    const b = priced({ item: fruit, usd: 2, country: "XB" });
    expect(receiptLine(0, a, b)).toBe("01  12 FAKE EGGS XA  vs  1KG FAKE FRUIT XB");
  });

  it("shows the real pack when a price was scaled", () => {
    const scaled = priced({ item: eggs, usd: 3.6, pack: [10, "pcs"] });
    expect(localPriceText(scaled)).toBe("US$3.00 for 10, scaled to 12");
    expect(localPriceText(priced({ item: eggs, usd: 3 }))).toBe("US$3.00 on the shelf");
  });
});

describe("Turns out…", () => {
  it("names the pricier item first, with the difference in US dollars", () => {
    const a = priced({ item: fruit, usd: 2, country: "XA", countryName: "Fakeland A" });
    const b = priced({ item: eggs, usd: 2.46, country: "XB", countryName: "Fakeland B" });
    expect(turnsOutSentence(a, b)).toBe(
      "12 fake eggs in Fakeland B cost 23% more than 1 kg of fake fruit in Fakeland A.",
    );
  });

  it("says it once for the same item in two countries", () => {
    const a = priced({ item: fruit, usd: 3, country: "XA", countryName: "Fakeland A" });
    const b = priced({
      item: fruit,
      usd: 2.5,
      country: "XB",
      countryName: "Fake Isles",
      countryInSentence: "the Fake Isles",
    });
    expect(turnsOutSentence(a, b)).toBe(
      "1 kg of fake fruit in Fakeland A costs 20% more than in the Fake Isles.",
    );
  });

  it("announces the result and both prices", () => {
    const a = priced({ item: fruit, usd: 3 });
    const b = priced({ item: eggs, usd: 2.5, countryName: "Fakeland B" });
    expect(
      announcement(true, [
        { price: a, display: "CHF 2.40" },
        { price: b, display: "CHF 2.00" },
      ]),
    ).toBe("Right. 1 kg fake fruit in Fakeland A: CHF 2.40. 12 fake eggs in Fakeland B: CHF 2.00.");
  });
});

describe("share", () => {
  const catalog = fakeCatalog();
  const rates = ratesFor(catalog.prices, catalog.fx);
  const pricedMap = new Map(catalog.prices.map((p) => [p.id, pricedItem(p, catalog)]));
  const [generated] = generateDays({
    prices: [...pricedMap.values()].map((p) => generatorPrice(p, rates)),
    from: 42,
    to: 42,
  });
  const day = dailyPuzzle(generated!, pricedMap, catalog.fx, catalog.polls);
  const answers = [true, true, false, true, true, true, true, false, true, true].map((correct) => ({
    correct,
  }));

  it("asks a question about one of today's pairs, never its answer", () => {
    const pair = teaserPair(day);
    expect(pair.kind).toBe("different");
    const question = teaser(pair.a, pair.b);
    expect(question).toMatch(
      /^Fake thing \d+ in Fakeland [A-T] or fake thing \d+ in Fakeland [A-T]\?$/,
    );
  });

  it("builds the daily share text with no prices in it", () => {
    const text = buildShareText({ ...dailyShare(day, answers), baseUrl: "https://example.test" });
    const lines = text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Sticker Shock #42 · 8/10");
    expect(lines[1]).toBe("🟩🟩🟥🟩🟩🟩🟩🟥🟩🟩");
    expect(lines[2]).toMatch(/\?$/);
    expect(lines[3]).toBe("https://example.test/sticker-shock?ref=share");
    expect(text).not.toMatch(/\d+\.\d{2}/);
  });

  it("shares an Endless streak", () => {
    const text = buildShareText({ ...endlessShare(14), baseUrl: "https://example.test" });
    expect(text).toBe(
      "Sticker Shock Endless · streak 14\nhttps://example.test/sticker-shock?ref=share",
    );
  });
});
