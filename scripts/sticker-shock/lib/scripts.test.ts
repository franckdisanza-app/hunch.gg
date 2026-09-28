import { fakeCatalog } from "@/games/sticker-shock/__fixtures__/fake-catalog";
import { accuracyReport, flagFor } from "./accuracy";
import { candidateRow, type OpenPricesEntry } from "./open-prices";
import { toCsv } from "./prices-csv";
import { prepareProof, priceIdOf, withProofUrls } from "./proofs";

describe("accuracy", () => {
  const row = (pair: string, n: number, share: number) => ({
    puzzle: 7,
    pair_id: pair,
    n,
    share_correct: share,
  });

  it("flags pairs that are too easy or look wrong, once enough people answered", () => {
    expect(flagFor(row("p0007-01", 100, 0.9))).toBe("too easy");
    expect(flagFor(row("p0007-02", 100, 0.1))).toBe("check the data");
    expect(flagFor(row("p0007-03", 100, 0.5))).toBeNull();
    expect(flagFor(row("p0007-04", 10, 0.99))).toBeNull();
  });

  it("lists flagged pairs first, with their labels", () => {
    const text = accuracyReport(
      [row("p0007-01", 100, 0.5), row("p0007-02", 80, 0.92)],
      new Map([["p0007-02", "FAKE 1 XA vs FAKE 2 XB"]]),
    );
    expect(text).toMatch(/2 pairs, 180 answers/);
    expect(text).toMatch(/Flagged \(1\):\np0007-02 +80 +92% +\[too easy\] FAKE 1 XA vs FAKE 2 XB/);
  });
});

describe("proofs", () => {
  it("takes the price ID from the file name", () => {
    expect(priceIdOf("xa-fake-item-1.JPG")).toBe("xa-fake-item-1");
    expect(priceIdOf("notes.txt")).toBeNull();
    expect(priceIdOf("../escape.png")).toBeNull();
  });

  it("names a cleaned proof by its content", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const proof = prepareProof("xa-fake-item-1", png);
    expect(proof.path).toMatch(/^sticker-shock\/xa-fake-item-1-[0-9a-f]{10}\.png$/);
    expect(proof.contentType).toBe("image/png");
    expect(prepareProof("xa-fake-item-1", png).path).toBe(proof.path);
  });

  it("writes proof URLs into prices.csv and keeps every other cell", () => {
    const csv = toCsv(
      ["id", "store", "proofImage", "notes"],
      [
        { id: "xa-fake-item-1", store: "Fake Mart", proofImage: "", notes: 'a "quoted", note' },
        { id: "xa-fake-item-2", store: "Fake Mart", proofImage: "/old.svg", notes: "" },
      ],
    );
    const out = withProofUrls(csv, new Map([["xa-fake-item-1", "https://example.test/p.png"]]));
    expect(out.split("\n")).toEqual([
      "id,store,proofImage,notes",
      'xa-fake-item-1,Fake Mart,https://example.test/p.png,"a ""quoted"", note"',
      "xa-fake-item-2,Fake Mart,/old.svg,",
      "",
    ]);
  });
});

describe("Open Prices candidates", () => {
  const { items, countries } = fakeCatalog();
  const item = { ...items[1]!, unit: "kg" as const, quantity: 1 };
  const map = { category_tag: "en:fake-fruit", price_per: "KILOGRAM" as const };
  const entry: OpenPricesEntry = {
    id: 12345,
    category_tag: "en:fake-fruit",
    price: 2.5,
    price_per: "KILOGRAM",
    price_is_discounted: false,
    currency: countries[0]!.currency,
    date: "2026-01-05",
    location: {
      osm_name: "Fake Market Street",
      osm_brand: "Fake Mart",
      osm_address_city: "Fake City",
      osm_address_country_code: countries[0]!.code.toLowerCase(),
    },
    proof: { id: 9, type: "PRICE_TAG", file_path: "0001/fake.webp" },
  };

  it("keeps the ODbL credit and leaves the checks to a person", () => {
    const row = candidateRow(entry, item, map, countries)!;
    expect(row).toMatchObject({
      country: countries[0]!.code,
      priceLocal: "2.5",
      packQuantity: "1",
      packUnit: "kg",
      store: "Fake Mart",
      sourceUrl: "https://prices.openfoodfacts.org/prices/12345",
      licence: "ODbL",
      regular: "",
      taxIncluded: "",
      proofImage: "",
      openPricesProof: "https://prices.openfoodfacts.org/img/0001/fake.webp",
    });
    expect(row.notes).toMatch(/ODbL/);
  });

  it("skips discounts, other countries, other currencies and prices without proof", () => {
    expect(candidateRow({ ...entry, price_is_discounted: true }, item, map, countries)).toBeNull();
    expect(candidateRow({ ...entry, price_is_discounted: null }, item, map, countries)).toBeNull();
    expect(candidateRow({ ...entry, currency: "XXX" }, item, map, countries)).toBeNull();
    expect(
      candidateRow(
        { ...entry, location: { ...entry.location!, osm_address_country_code: "zz" } },
        item,
        map,
        countries,
      ),
    ).toBeNull();
    expect(candidateRow({ ...entry, proof: null }, item, map, countries)).toBeNull();
  });
});
