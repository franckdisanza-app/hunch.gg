import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as z from "zod/mini";
import { distanceKm, type BBox, type GeoPoint } from "@/engines/map/geo";

// OpenStreetMap features through the Overpass API, for `pnpm ping:furthest`. Following the
// Overpass usage policy: one query at a time, an identifying User-Agent, backing off on 429 and
// 504, and every response cached in .cache/ping/ so a question is never fetched twice.
// Data © OpenStreetMap contributors, available under the Open Database License (ODbL).

export const OSM_CREDIT = "© OpenStreetMap contributors, ODbL";
export const OSM_LICENCE = "ODbL 1.0 (© OpenStreetMap contributors)";
export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Ways are sampled at least this often, so distances to roads and coasts are to the line. */
const DENSIFY_KM = 0.5;

export interface OsmFeature extends GeoPoint {
  /** "node/123", "way/456": where the point comes from. */
  ref: string;
  name?: string;
  town?: string;
}

/**
 * An Overpass QL query for every node, way and relation matching `filter` (the inside of a tag
 * filter, e.g. `amenity=fast_food` or `"brand:wikidata"="Q…"`) in a box, with geometry.
 */
export function overpassQuery(filter: string, [west, south, east, north]: BBox): string {
  const boxes =
    west <= east
      ? [[south, west, north, east]]
      : [
          [south, west, north, 180],
          [south, -180, north, east],
        ];
  const parts = boxes.flatMap((box) =>
    ["node", "way", "relation"].map((type) => `${type}[${filter}](${box.join(",")});`),
  );
  return `[out:json][timeout:900];(${parts.join("")});out geom qt;`;
}

const point = z.object({ lat: z.number(), lon: z.number() });
const element = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number(),
  lat: z.optional(z.number()),
  lon: z.optional(z.number()),
  center: z.optional(point),
  geometry: z.optional(z.array(z.nullable(point))),
  members: z.optional(z.array(z.object({ geometry: z.optional(z.array(z.nullable(point))) }))),
  tags: z.optional(z.record(z.string(), z.string())),
});
export const overpassResponseSchema = z.object({
  osm3s: z.object({ timestamp_osm_base: z.string() }),
  elements: z.array(element),
});
export type OverpassResponse = z.infer<typeof overpassResponseSchema>;

function densify(line: GeoPoint[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  line.forEach((p, i) => {
    const next = line[i + 1];
    out.push(p);
    if (!next) return;
    const pieces = Math.ceil(distanceKm(p, next) / DENSIFY_KM);
    for (let k = 1; k < pieces; k++) {
      out.push({
        lat: p.lat + ((next.lat - p.lat) * k) / pieces,
        lon: p.lon + ((next.lon - p.lon) * k) / pieces,
      });
    }
  });
  return out;
}

/** Every point to measure against, with the name and town of the feature it belongs to. */
export function featuresFrom(response: OverpassResponse): {
  features: OsmFeature[];
  dataAsOf: string;
} {
  const features: OsmFeature[] = [];
  for (const el of response.elements) {
    const ref = `${el.type}/${el.id}`;
    const tags = el.tags ?? {};
    const name = tags.name ?? tags.brand;
    const town = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"];
    const add = (p: GeoPoint) =>
      features.push({
        lat: p.lat,
        lon: p.lon,
        ref,
        ...(name ? { name } : {}),
        ...(town ? { town } : {}),
      });
    if (el.lat !== undefined && el.lon !== undefined) add({ lat: el.lat, lon: el.lon });
    const lines = [el.geometry, ...(el.members ?? []).map((m) => m.geometry)].filter(Boolean);
    for (const line of lines) densify(line!.filter((p): p is GeoPoint => p !== null)).forEach(add);
    if (!lines.length && el.center) add(el.center);
  }
  return { features, dataAsOf: response.osm3s.timestamp_osm_base.slice(0, 10) };
}

export interface FetchOptions {
  cacheDir: string;
  endpoint?: string;
  /** Identifies the script to the Overpass operators (their usage policy asks for it). */
  userAgent: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

/** Runs a query once: from the cache when it has been run before, else from Overpass. */
export async function fetchOverpass(
  query: string,
  options: FetchOptions,
): Promise<OverpassResponse> {
  const hash = createHash("sha256").update(query).digest("hex").slice(0, 16);
  const cached = join(options.cacheDir, `overpass-${hash}.json`);
  if (existsSync(cached)) {
    options.log?.(`Using cached ${cached}`);
    return z.parse(overpassResponseSchema, JSON.parse(readFileSync(cached, "utf8")));
  }
  const doFetch = options.fetchImpl ?? fetch;
  for (let attempt = 1; ; attempt++) {
    options.log?.(`Querying ${options.endpoint ?? OVERPASS_ENDPOINT} (attempt ${attempt})…`);
    const res = await doFetch(options.endpoint ?? OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": options.userAgent,
      },
      body: new URLSearchParams({ data: query }).toString(),
    });
    if ((res.status === 429 || res.status === 504) && attempt < 4) {
      const wait = Number(res.headers.get("retry-after")) || 30 * attempt;
      options.log?.(`Overpass is busy (${res.status}); waiting ${wait} s as its policy asks.`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!res.ok)
      throw new Error(`Overpass answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const text = await res.text();
    const data = z.parse(overpassResponseSchema, JSON.parse(text));
    mkdirSync(options.cacheDir, { recursive: true });
    writeFileSync(cached, text);
    return data;
  }
}
