import type { Country, FxEntry, Item, Poll, Price } from "../content.schema";
import { roundMoney } from "../pricing";
import { seededRandom } from "../random";

// An obviously fake catalog for tests: private-use country codes (XA…), made-up currencies,
// "Fake Mart", example.test URLs. Big enough (20 × 25 prices) for the real generator rules.

export const FAKE_DATE = "2026-01-05";

export function fakeCatalog(options: { countries?: number; items?: number; seed?: string } = {}) {
  const countryCount = options.countries ?? 20;
  const itemCount = options.items ?? 25;
  const random = seededRandom(options.seed ?? "fake-catalog");

  const items: Item[] = Array.from({ length: itemCount }, (_, i) => ({
    id: `fake-item-${i + 1}`,
    label: `fake thing ${i + 1}`,
    quantity: i % 3 === 0 ? 12 : 1,
    unit: i % 3 === 0 ? "pcs" : i % 3 === 1 ? "kg" : "l",
    receipt: `FAKE ${i + 1}`,
    icon: `fake-item-${i + 1}`,
    category: "pantry",
  }));

  const countries: Country[] = Array.from({ length: countryCount }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { code: `X${letter}`, name: `Fakeland ${letter}`, currency: `XQ${letter}` };
  });

  const usdPer: Record<string, number> = { CHF: 1.25, EUR: 1.1, GBP: 1.3 };
  countries.forEach((c, i) => (usdPer[c.currency] = 0.5 + i * 0.1));

  const fx: FxEntry[] = [
    {
      date: FAKE_DATE,
      usdPer,
      sourceTitle: "Fake Rates Bureau",
      sourceUrl: "https://example.test/fake-rates",
      checkedOn: FAKE_DATE,
      licence: "Fake licence",
      sample: true,
    },
  ];

  const prices: Price[] = [];
  for (const country of countries) {
    const level = 0.6 + random();
    for (const item of items) {
      const usd = (1 + random() * 4) * level;
      const rate = usdPer[country.currency]!;
      const id = `${country.code.toLowerCase()}-${item.id}`;
      prices.push({
        id,
        itemId: item.id,
        country: country.code,
        currency: country.currency,
        priceLocal: roundMoney(usd / rate, country.currency),
        packQuantity: item.quantity,
        packUnit: item.unit,
        fxToUsd: rate,
        fxDate: FAKE_DATE,
        store: "Fake Mart",
        sourceUrl: `https://example.test/fake-mart/${id}`,
        proofImage: "/fake-proof.svg",
        capturedOn: FAKE_DATE,
        licence: "own",
        regular: true,
        taxIncluded: true,
        sample: true,
      });
    }
  }

  const polls: Poll[] = [
    {
      id: "fake-poll",
      question: "Fake question?",
      options: [
        { id: "a", label: "Fake A" },
        { id: "b", label: "Fake B" },
      ],
    },
  ];

  return { items, countries, fx, prices, polls };
}
