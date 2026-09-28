// Price maths for Sticker Shock. Pure functions, shared by the build scripts, the pool API and the
// browser, so an answer is computed the same way everywhere.
//
// - Every price is scaled to its item's quantity (a pack of 10 eggs becomes 12 eggs).
// - The right answer is decided in US dollars, with the exchange rate frozen at capture.
// - The display currency (CHF, EUR, GBP or USD) is cosmetic: it converts from US dollars at the
//   rate of the same capture date, and the generator only keeps pairs whose order is the same in
//   every display currency.

export const DISPLAY_CURRENCIES = ["CHF", "EUR", "GBP", "USD"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const UNITS = ["kg", "g", "l", "ml", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

/** The price ratio of every pair: the pricier item costs 5–40% more than the cheaper one. */
export const MIN_RATIO = 1.05;
export const MAX_RATIO = 1.4;
/** Floating point slack for the ratio bounds. */
const EPSILON = 1e-9;

const UNIT_BASE: Record<Unit, { dimension: "mass" | "volume" | "count"; factor: number }> = {
  kg: { dimension: "mass", factor: 1000 },
  g: { dimension: "mass", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  pcs: { dimension: "count", factor: 1 },
};

export interface Quantity {
  quantity: number;
  unit: Unit;
}

export function unitsCompatible(a: Unit, b: Unit): boolean {
  return UNIT_BASE[a].dimension === UNIT_BASE[b].dimension;
}

/** How many packs make one item: 12 eggs from a pack of 10 is 1.2. */
export function packScale(item: Quantity, pack: { packQuantity: number; packUnit: Unit }): number {
  if (!unitsCompatible(item.unit, pack.packUnit)) {
    throw new Error(`Cannot scale ${pack.packUnit} to ${item.unit}`);
  }
  const itemAmount = item.quantity * UNIT_BASE[item.unit].factor;
  const packAmount = pack.packQuantity * UNIT_BASE[pack.packUnit].factor;
  return itemAmount / packAmount;
}

/** Whether the shelf pack differs from the item definition, so the reveal shows the real pack. */
export function isScaled(item: Quantity, pack: { packQuantity: number; packUnit: Unit }): boolean {
  return Math.abs(packScale(item, pack) - 1) > EPSILON;
}

export interface PriceInput {
  priceLocal: number;
  packQuantity: number;
  packUnit: Unit;
  fxToUsd: number;
}

/** The local price for the item's quantity. */
export function scaledLocalPrice(price: PriceInput, item: Quantity): number {
  return price.priceLocal * packScale(item, price);
}

/** The item's price in US dollars, at the rate frozen at capture. This decides every answer. */
export function usdPrice(price: PriceInput, item: Quantity): number {
  return scaledLocalPrice(price, item) * price.fxToUsd;
}

/**
 * Converts US dollars to a display currency. `usdPer` gives US dollars per unit of each currency
 * on the price's capture date (USD itself is always 1).
 */
export function toDisplay(
  usd: number,
  currency: DisplayCurrency,
  usdPer: Readonly<Record<string, number>>,
): number {
  if (currency === "USD") return usd;
  const rate = usdPer[currency];
  if (!rate || !(rate > 0)) throw new Error(`No ${currency} rate`);
  return usd / rate;
}

const digitsCache = new Map<string, number>();

/** Digits after the decimal point for a currency, as Intl formats it (JPY 0, CHF 2…). */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    digitsCache.set(currency, digits);
  }
  return digits;
}

/** Rounds an amount to what is shown for its currency (half away from zero). */
export function roundMoney(amount: number, currency: string): number {
  const factor = 10 ** currencyDigits(currency);
  return (Math.sign(amount) * Math.round(Math.abs(amount) * factor + EPSILON)) / factor;
}

/** Pricier over cheaper, always ≥ 1. */
export function priceRatio(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  if (!(lo > 0)) throw new Error("Prices must be positive");
  return hi / lo;
}

export function ratioInRange(ratio: number): boolean {
  return ratio >= MIN_RATIO - EPSILON && ratio <= MAX_RATIO + EPSILON;
}

/** Index of the pricier of two US dollar prices. Ties never reach players (ratio ≥ 1.05). */
export function pricierIndex(usdA: number, usdB: number): 0 | 1 {
  return usdA >= usdB ? 0 : 1;
}

/** "costs n% more", rounded to a whole percent. */
export function percentMore(pricierUsd: number, cheaperUsd: number): number {
  return Math.round((pricierUsd / cheaperUsd - 1) * 100 + EPSILON);
}

/**
 * Whether the displayed prices tell the same story as the US dollar answer in every display
 * currency: same order, and different amounts once rounded.
 */
export function displayOrderAgrees(
  a: { usd: number; usdPer: Readonly<Record<string, number>> },
  b: { usd: number; usdPer: Readonly<Record<string, number>> },
): boolean {
  const answer = pricierIndex(a.usd, b.usd);
  return DISPLAY_CURRENCIES.every((currency) => {
    const da = roundMoney(toDisplay(a.usd, currency, a.usdPer), currency);
    const db = roundMoney(toDisplay(b.usd, currency, b.usdPer), currency);
    if (da === db) return false;
    return (da > db ? 0 : 1) === answer;
  });
}

/** The display currency for a browser locale: CH → CHF, euro area → EUR, UK → GBP, else USD. */
export function defaultDisplayCurrency(locales: readonly string[]): DisplayCurrency {
  for (const locale of locales) {
    const region = regionOf(locale);
    if (!region) continue;
    if (region === "CH" || region === "LI") return "CHF";
    if (region === "GB" || region === "GG" || region === "JE" || region === "IM") return "GBP";
    if (EURO_REGIONS.has(region)) return "EUR";
    return "USD";
  }
  return "USD";
}

// Countries and territories whose everyday currency is the euro (2026).
const EURO_REGIONS = new Set([
  "AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV",
  "MT", "NL", "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK", "GF", "GP", "MQ", "RE", "YT",
  "PM", "BL", "MF", "AX",
]); // prettier-ignore

function regionOf(locale: string): string | undefined {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region?.toUpperCase();
  } catch {
    return undefined;
  }
}
