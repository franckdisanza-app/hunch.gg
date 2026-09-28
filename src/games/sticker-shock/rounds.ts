import type { ChoiceRound } from "@/engines/choice/state";
import type { DailyPuzzle, DayRates, PricedItem } from "./content.schema";
import type { GeneratedPair } from "./generator";
import { pricierIndex, toDisplay, usdPrice, type DisplayCurrency } from "./pricing";

// A Sticker Shock round for the choice engine: two priced items, the pricier one is right.

export interface PriceRound extends ChoiceRound<PricedItem> {
  options: readonly [PricedItem, PricedItem];
  kind: "same" | "different";
  /** Hand-written "Turns out…" text from the daily file. */
  turnsOut?: string;
}

export function correctIndex(round: PriceRound): number {
  const [a, b] = round.options;
  return pricierIndex(usdPrice(a, a.item), usdPrice(b, b.item));
}

export function roundsFromDaily(day: DailyPuzzle): PriceRound[] {
  return day.pairs.map((pair) => ({
    id: pair.id,
    options: [pair.a, pair.b] as const,
    kind: pair.kind,
    ...(pair.turnsOut ? { turnsOut: pair.turnsOut } : {}),
  }));
}

export function roundFromPair(
  pair: GeneratedPair,
  prices: ReadonlyMap<string, PricedItem>,
  index: number,
): PriceRound {
  const a = prices.get(pair.a);
  const b = prices.get(pair.b);
  if (!a || !b) throw new Error("Unknown price in pair");
  return { id: `e${index + 1}`, options: [a, b], kind: pair.kind };
}

/** The price in the display currency, at its capture date's rate. */
export function displayAmount(
  price: PricedItem,
  currency: DisplayCurrency,
  rates: Readonly<Record<string, Pick<DayRates, "usdPer">>>,
): number {
  const day = rates[price.fxDate];
  if (!day) throw new Error(`No rates for ${price.fxDate}`);
  return toDisplay(usdPrice(price, price.item), currency, day.usdPer);
}
