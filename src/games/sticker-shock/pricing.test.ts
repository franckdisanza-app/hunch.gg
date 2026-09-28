import {
  defaultDisplayCurrency,
  displayOrderAgrees,
  isScaled,
  packScale,
  percentMore,
  priceRatio,
  pricierIndex,
  ratioInRange,
  roundMoney,
  scaledLocalPrice,
  toDisplay,
  usdPrice,
} from "./pricing";

// Every number here is made up.

describe("pack scaling", () => {
  it("scales a shelf pack to the item's quantity", () => {
    expect(packScale({ quantity: 12, unit: "pcs" }, { packQuantity: 10, packUnit: "pcs" })).toBe(
      1.2,
    );
    expect(
      packScale({ quantity: 1, unit: "l" }, { packQuantity: 750, packUnit: "ml" }),
    ).toBeCloseTo(4 / 3);
    expect(packScale({ quantity: 250, unit: "g" }, { packQuantity: 0.5, packUnit: "kg" })).toBe(
      0.5,
    );
  });

  it("knows when the reveal must show the real pack", () => {
    expect(isScaled({ quantity: 1, unit: "kg" }, { packQuantity: 1000, packUnit: "g" })).toBe(
      false,
    );
    expect(isScaled({ quantity: 12, unit: "pcs" }, { packQuantity: 6, packUnit: "pcs" })).toBe(
      true,
    );
  });

  it("refuses to scale across dimensions", () => {
    expect(() =>
      packScale({ quantity: 1, unit: "kg" }, { packQuantity: 1, packUnit: "l" }),
    ).toThrow();
  });
});

describe("US dollar comparison", () => {
  const item = { quantity: 12, unit: "pcs" as const };
  const price = { priceLocal: 10, packQuantity: 10, packUnit: "pcs" as const, fxToUsd: 0.5 };

  it("converts the scaled local price at the frozen rate", () => {
    expect(scaledLocalPrice(price, item)).toBe(12);
    expect(usdPrice(price, item)).toBe(6);
  });

  it("decides the pricier one in US dollars", () => {
    expect(pricierIndex(6, 5)).toBe(0);
    expect(pricierIndex(5, 6)).toBe(1);
  });

  it("measures the ratio and the percentage", () => {
    expect(priceRatio(5, 6)).toBeCloseTo(1.2);
    expect(priceRatio(6, 5)).toBeCloseTo(1.2);
    expect(percentMore(6.15, 5)).toBe(23);
    expect(percentMore(5.25, 5)).toBe(5);
    expect(percentMore(7, 5)).toBe(40);
  });

  it("keeps pairs between 1.05 and 1.40, bounds included", () => {
    expect(ratioInRange(1.05)).toBe(true);
    expect(ratioInRange(1.4)).toBe(true);
    expect(ratioInRange(5.25 / 5)).toBe(true);
    expect(ratioInRange(1.049)).toBe(false);
    expect(ratioInRange(1.401)).toBe(false);
  });
});

describe("display conversion and rounding", () => {
  const usdPer = { CHF: 1.25, EUR: 1.1, GBP: 1.3 };

  it("converts from US dollars at the capture date's rate", () => {
    expect(toDisplay(10, "CHF", usdPer)).toBe(8);
    expect(toDisplay(10, "USD", usdPer)).toBe(10);
    expect(toDisplay(11, "EUR", usdPer)).toBeCloseTo(10);
    expect(() => toDisplay(10, "GBP", {})).toThrow();
  });

  it("rounds to each currency's digits, half away from zero", () => {
    expect(roundMoney(2.345, "CHF")).toBe(2.35);
    expect(roundMoney(2.344, "EUR")).toBe(2.34);
    expect(roundMoney(123.5, "JPY")).toBe(124);
    expect(roundMoney(0.125, "USD")).toBe(0.13);
  });

  it("rejects pairs whose order flips in a display currency", () => {
    // 6% dearer in US dollars, but the two capture dates' CHF rates differ by more than that.
    const a = { usd: 10.6, usdPer: { ...usdPer, CHF: 1.3 } };
    const b = { usd: 10, usdPer: { ...usdPer, CHF: 1.15 } };
    expect(displayOrderAgrees(a, b)).toBe(false);
    expect(displayOrderAgrees({ ...a, usdPer }, { ...b, usdPer })).toBe(true);
  });

  it("rejects pairs that look equal once rounded", () => {
    expect(displayOrderAgrees({ usd: 0.0105, usdPer }, { usd: 0.01, usdPer })).toBe(false);
  });
});

describe("default display currency", () => {
  it("follows the browser's region", () => {
    expect(defaultDisplayCurrency(["de-CH"])).toBe("CHF");
    expect(defaultDisplayCurrency(["fr-FR"])).toBe("EUR");
    expect(defaultDisplayCurrency(["de"])).toBe("EUR");
    expect(defaultDisplayCurrency(["en-GB"])).toBe("GBP");
    expect(defaultDisplayCurrency(["en-US"])).toBe("USD");
    expect(defaultDisplayCurrency(["ja-JP"])).toBe("USD");
    expect(defaultDisplayCurrency(["it-CH", "en-US"])).toBe("CHF");
  });

  it("falls back to US dollars", () => {
    expect(defaultDisplayCurrency([])).toBe("USD");
    expect(defaultDisplayCurrency(["not a locale!"])).toBe("USD");
  });
});
