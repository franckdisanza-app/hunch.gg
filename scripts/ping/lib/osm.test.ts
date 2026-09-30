import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { distanceKm } from "@/engines/map/geo";
import { featuresFrom, fetchOverpass, overpassQuery, type OverpassResponse } from "./osm";
import { loadRegion } from "./region";

// A made-up Overpass response: fake names, simple coordinates. Nothing is fetched.
const RESPONSE: OverpassResponse = {
  osm3s: { timestamp_osm_base: "2026-09-29T12:00:00Z" },
  elements: [
    {
      type: "node",
      id: 1,
      lat: 10,
      lon: 20,
      tags: { name: "Fake Diner", "addr:city": "Fake Town" },
    },
    {
      type: "way",
      id: 2,
      geometry: [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.1 },
      ],
      tags: { highway: "track" },
    },
    { type: "relation", id: 3, center: { lat: -5, lon: 5 }, tags: { brand: "Fake Brand" } },
  ],
};

describe("overpassQuery", () => {
  it("asks for nodes, ways and relations in the box, with geometry", () => {
    const query = overpassQuery("amenity=fast_food", [5, 45, 11, 48]);
    expect(query).toContain("node[amenity=fast_food](45,5,48,11);");
    expect(query).toContain("way[amenity=fast_food](45,5,48,11);");
    expect(query).toMatch(/out geom qt;$/);
  });

  it("splits a box across the antimeridian", () => {
    const query = overpassQuery("highway", [170, -20, -170, 0]);
    expect(query).toContain("node[highway](-20,170,0,180);");
    expect(query).toContain("node[highway](-20,-180,0,-170);");
  });
});

describe("featuresFrom", () => {
  it("keeps names and towns, samples ways densely and dates the data", () => {
    const { features, dataAsOf } = featuresFrom(RESPONSE);
    expect(dataAsOf).toBe("2026-09-29");
    expect(features[0]).toEqual({
      lat: 10,
      lon: 20,
      ref: "node/1",
      name: "Fake Diner",
      town: "Fake Town",
    });
    const way = features.filter((f) => f.ref === "way/2");
    // 0.1° at the equator is about 11 km: sampled every half kilometre or less.
    expect(way.length).toBeGreaterThanOrEqual(23);
    for (let i = 1; i < way.length; i++)
      expect(distanceKm(way[i - 1]!, way[i]!)).toBeLessThanOrEqual(0.5);
    expect(features.at(-1)).toEqual({ lat: -5, lon: 5, ref: "relation/3", name: "Fake Brand" });
  });
});

describe("fetchOverpass", () => {
  it("fetches once, then answers from the cache", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "ping-osm-"));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(RESPONSE)));
    const options = {
      cacheDir,
      userAgent: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };
    const first = await fetchOverpass("fake query", options);
    const second = await fetchOverpass("fake query", options);
    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("test");
  });
});

describe("loadRegion", () => {
  it("finds a country in Natural Earth by name", () => {
    const region = loadRegion(process.cwd(), "switzerland");
    expect(region.name).toBe("Switzerland");
    const [west, south, east, north] = region.bbox;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
  });

  it("reads a GeoJSON file and explains unknown names", () => {
    const dir = mkdtempSync(join(tmpdir(), "ping-region-"));
    const file = join(dir, "fake.geojson");
    writeFileSync(
      file,
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      }),
    );
    expect(loadRegion(process.cwd(), file).bbox).toEqual([0, 0, 1, 1]);
    expect(() => loadRegion(process.cwd(), "Nowhereland")).toThrow(/No country named/);
  });
});
