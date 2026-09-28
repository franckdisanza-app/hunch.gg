import * as z from "zod/mini";
import type { Country, Item } from "@/games/sticker-shock/content.schema";
import { PRICE_COLUMNS } from "./prices-csv";

// The logic behind `pnpm sticker-shock:open-prices`: turn Open Prices entries into candidate rows
// for review. Open Prices (prices.openfoodfacts.org) is published by Open Food Facts under the
// Open Database License (ODbL); every row keeps the credit and a link to its entry.

export const OPEN_PRICES = "https://prices.openfoodfacts.org";

/** content/sticker-shock/open-prices-map.json: item ID → how Open Prices files it. */
export const openPricesMapSchema = z.record(
  z.string(),
  z.strictObject({
    /** Open Food Facts category of raw products, e.g. "en:bananas". */
    category_tag: z.string().check(z.regex(/^[a-z]{2}:[a-z0-9-]+$/)),
    /** What the price is per on Open Prices: a kilogram, or one unit. */
    price_per: z.enum(["KILOGRAM", "UNIT"]),
  }),
);
export type OpenPricesMap = z.infer<typeof openPricesMapSchema>;

// Only the fields the review needs; everything else in the API response is ignored.
export const openPricesPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.int(),
      category_tag: z.nullable(z.string()),
      price: z.number(),
      price_per: z.nullable(z.string()),
      price_is_discounted: z.nullable(z.boolean()),
      currency: z.string(),
      date: z.string(),
      location: z.nullable(
        z.object({
          osm_name: z.nullable(z.string()),
          osm_brand: z.nullable(z.string()),
          osm_address_city: z.nullable(z.string()),
          osm_address_country_code: z.nullable(z.string()),
        }),
      ),
      proof: z.nullable(
        z.object({
          id: z.int(),
          type: z.nullable(z.string()),
          file_path: z.nullable(z.string()),
        }),
      ),
    }),
  ),
  page: z.int(),
  pages: z.int(),
});
export type OpenPricesEntry = z.infer<typeof openPricesPageSchema>["items"][number];

export const REVIEW_COLUMNS = [
  ...PRICE_COLUMNS,
  "openPricesId",
  "location",
  "proofType",
  "openPricesProof",
] as const;

/**
 * A candidate row in prices.csv format, plus review columns. Left for a person to decide:
 * `regular` and `taxIncluded` (Open Prices does not record either), the rate (add the capture
 * date to fx.json), and the proof (check its licence, then save it and run sticker-shock:proofs).
 */
export function candidateRow(
  entry: OpenPricesEntry,
  item: Item,
  map: OpenPricesMap[string],
  countries: readonly Country[],
): Record<string, string> | null {
  const cc = entry.location?.osm_address_country_code?.toUpperCase();
  const country = countries.find((c) => c.code === cc);
  if (!country || entry.currency !== country.currency) return null;
  if (entry.price_is_discounted !== false) return null;
  if (entry.category_tag !== map.category_tag || entry.price_per !== map.price_per) return null;
  if (!entry.proof?.file_path) return null;
  const pack = map.price_per === "KILOGRAM" ? { q: "1", unit: "kg" } : { q: "1", unit: "pcs" };
  const store = entry.location?.osm_brand || entry.location?.osm_name || "";
  if (!store) return null;
  return {
    id: `${country.code.toLowerCase()}-${item.id}-op${entry.id}`,
    itemId: item.id,
    country: country.code,
    currency: country.currency,
    priceLocal: String(entry.price),
    packQuantity: pack.q,
    packUnit: pack.unit,
    fxToUsd: "",
    fxDate: entry.date,
    store,
    sourceUrl: `${OPEN_PRICES}/prices/${entry.id}`,
    proofImage: "",
    capturedOn: entry.date,
    licence: "ODbL",
    regular: "",
    taxIncluded: "",
    notes: `Open Prices #${entry.id} (ODbL, Open Food Facts contributors). Check: regular price, tax included, proof licence.`,
    sample: "",
    openPricesId: String(entry.id),
    location: [entry.location?.osm_name, entry.location?.osm_address_city]
      .filter(Boolean)
      .join(", "),
    proofType: entry.proof.type ?? "",
    openPricesProof: `${OPEN_PRICES}/img/${entry.proof.file_path}`,
  };
}
