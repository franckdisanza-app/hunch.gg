import {
  formatCountdown,
  formatCurrency,
  formatCurrencyParts,
  formatIsoDate,
  formatNumber,
  formatPercent,
} from "./format";

describe("format", () => {
  it("formats numbers, percentages and currencies with Intl", () => {
    expect(formatNumber(1234567.8, "en-US")).toBe("1,234,567.8");
    // The Swiss grouping mark differs between CLDR versions (’ or ').
    expect(formatNumber(1234567.8, "de-CH")).toMatch(/^1['’]234['’]567\.8$/);
    expect(formatPercent(0.537, "en-US")).toBe("54%");
    // Intl separates the currency code with a non-breaking space.
    expect(formatCurrency(12.5, "CHF", "de-CH")).toBe("CHF 12.50");
  });

  it("splits a currency amount into sign and number", () => {
    expect(formatCurrencyParts(4.1, "CHF", "en-GB")).toEqual({ currency: "CHF", amount: "4.10" });
    expect(formatCurrencyParts(1234.5, "GBP", "en-GB")).toEqual({
      currency: "£",
      amount: "1,234.50",
    });
    expect(formatCurrencyParts(420, "JPY", "en-GB")).toEqual({ currency: "JP¥", amount: "420" });
  });

  it("formats ISO dates without a time-zone shift", () => {
    expect(formatIsoDate("2026-01-01", "en-GB", { dateStyle: "long" })).toBe("1 January 2026");
  });

  it("formats countdowns", () => {
    expect(formatCountdown(3 * 3_600_000 + 7 * 60_000 + 59_000)).toBe("03:07:59");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-5)).toBe("00:00:00");
    expect(formatCountdown(1)).toBe("00:00:01");
  });
});
