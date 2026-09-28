import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { Item, PricedItem } from "./content.schema";
import { isScaled, percentMore, usdPrice, type Unit } from "./pricing";
import { strings } from "./strings";

// Sentences and labels built from the data: card titles, receipt lines, "Turns out…", the share
// teaser and the screen reader announcement. Words come from strings.ts, numbers from lib/format.

const UNIT_LABEL: Record<Unit, string> = { kg: "kg", g: "g", l: "L", ml: "ml", pcs: "" };

type Quantity = Pick<Item, "quantity" | "unit">;

/** "12", "1 kg", "500 ml", "1.5 L". */
export function quantityLabel(q: { quantity: number; unit: Unit }): string {
  const n = formatNumber(q.quantity, undefined, { maximumFractionDigits: 2 });
  return q.unit === "pcs" ? n : `${n} ${UNIT_LABEL[q.unit]}`;
}

/** The card title: "12 eggs", "1 kg bananas" (shown in capitals). */
export function itemTitle(item: Quantity & Pick<Item, "label">): string {
  return `${quantityLabel(item)} ${item.label}`;
}

/** In a sentence: "12 eggs", "1 kg of bananas". */
export function itemPhrase(item: Quantity & Pick<Item, "label">): string {
  return item.unit === "pcs"
    ? `${quantityLabel(item)} ${item.label}`
    : `${quantityLabel(item)} of ${item.label}`;
}

/** "cost" for several pieces (12 eggs cost), "costs" for an amount (1 kg of bananas costs). */
export function costVerb(item: Quantity): string {
  return item.unit === "pcs" && item.quantity !== 1
    ? strings.turnsOut.cost
    : strings.turnsOut.costs;
}

/** Receipt abbreviation: "12 EGGS", "1KG BANANAS", "1.5L WATER". */
export function receiptItem(item: Quantity & Pick<Item, "receipt">): string {
  const n = String(item.quantity);
  return item.unit === "pcs"
    ? `${n} ${item.receipt}`
    : `${n}${UNIT_LABEL[item.unit].toUpperCase()} ${item.receipt}`;
}

/** "01  12 EGGS JP  vs  1KG BANANAS CH" (the mark is drawn separately). */
export function receiptLine(index: number, a: PricedItem, b: PricedItem): string {
  const no = String(index + 1).padStart(2, "0");
  return `${no}  ${receiptItem(a.item)} ${a.country}  ${strings.receipt.vs}  ${receiptItem(b.item)} ${b.country}`;
}

/** "Japan", "the Netherlands". */
export function countryInSentence(
  price: Pick<PricedItem, "countryName" | "countryInSentence">,
): string {
  return price.countryInSentence ?? price.countryName;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The generated "Turns out…" sentence, decided in US dollars. */
export function turnsOutSentence(a: PricedItem, b: PricedItem): string {
  const usdA = usdPrice(a, a.item);
  const usdB = usdPrice(b, b.item);
  const [pricier, cheaper] = usdA >= usdB ? [a, b] : [b, a];
  const percent = formatPercent(percentMore(Math.max(usdA, usdB), Math.min(usdA, usdB)) / 100);
  const verb = costVerb(pricier.item);
  if (a.itemId === b.itemId) {
    return strings.turnsOut.same(
      capitalise(itemPhrase(pricier.item)),
      verb,
      countryInSentence(pricier),
      percent,
      countryInSentence(cheaper),
    );
  }
  return strings.turnsOut.different(
    capitalise(itemPhrase(pricier.item)),
    countryInSentence(pricier),
    verb,
    percent,
    itemPhrase(cheaper.item),
    countryInSentence(cheaper),
  );
}

/** The share teaser: a question about one of today's pairs, never its answer. */
export function teaser(a: PricedItem, b: PricedItem): string {
  return strings.share.teaser(
    capitalise(a.item.label),
    countryInSentence(a),
    b.item.label,
    countryInSentence(b),
  );
}

/** Read out after a reveal: the result and both prices. */
export function announcement(
  correct: boolean,
  sides: readonly { price: PricedItem; display: string }[],
): string {
  return [
    correct ? strings.announce.right : strings.announce.wrong,
    ...sides.map(({ price, display }) =>
      strings.announce.price(itemTitle(price.item), price.countryName, display),
    ),
  ].join(" ");
}

/** "JP¥420 on the shelf", or "€3.49 for 10, scaled to 12" when the pack differs. */
export function localPriceText(price: PricedItem): string {
  const local = formatCurrency(price.priceLocal, price.currency);
  if (!isScaled(price.item, price)) return strings.price.local(local);
  return strings.price.scaled(
    local,
    quantityLabel({ quantity: price.packQuantity, unit: price.packUnit }),
    quantityLabel(price.item),
  );
}
