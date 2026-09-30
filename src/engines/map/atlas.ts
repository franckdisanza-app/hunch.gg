import { geoBounds, geoContains } from "d3-geo";
import type { Feature, MultiLineString, MultiPolygon, Polygon } from "geojson";
import { feature, mesh } from "topojson-client";
import { inBBox, toLonLat, type BBox, type GeoPoint } from "./geo";

// Land and country shapes from world-atlas (Natural Earth, public domain), loaded on demand: the
// 1:110m set right after the globe first draws, the 1:50m set once the player zooms in. Each is
// its own chunk, so no page pays for the map until it shows a globe.

export type AtlasDetail = "110m" | "50m";

export interface AtlasCountry {
  name: string;
  shape: Feature<Polygon | MultiPolygon>;
  /** [west, south, east, north], to skip most countries before the exact test. */
  bbox: BBox;
}

export interface Atlas {
  detail: AtlasDetail;
  land: Feature<Polygon | MultiPolygon>;
  /** Borders between countries (not coastlines). */
  borders: MultiLineString;
  countries: AtlasCountry[];
}

type Topology = Parameters<typeof feature>[0];
type TopoObject = Exclude<Parameters<typeof feature>[1], string>;

// Typed as unknown on purpose: letting TypeScript infer the type of a 750 KB JSON file is slow.
const LOADERS: Record<AtlasDetail, () => Promise<unknown>> = {
  "110m": () => import("world-atlas/countries-110m.json").then((m) => m.default as unknown),
  "50m": () => import("world-atlas/countries-50m.json").then((m) => m.default as unknown),
};

const cache = new Map<AtlasDetail, Promise<Atlas>>();

/** Builds an atlas from a world-atlas countries topology. */
export function atlasFromTopology(detail: AtlasDetail, data: unknown): Atlas {
  const topology = data as Topology & { objects: { countries: TopoObject; land: TopoObject } };
  const land = feature(topology, topology.objects.land) as unknown as Feature<
    Polygon | MultiPolygon
  >;
  const borders = mesh(
    topology,
    topology.objects.countries as NonNullable<Parameters<typeof mesh>[1]>,
    (a, b) => a !== b,
  );
  const collection = feature(topology, topology.objects.countries) as unknown as {
    features: Feature<Polygon | MultiPolygon, { name?: string }>[];
  };
  const countries = collection.features
    .filter((f) => f.geometry && f.properties?.name)
    .map((shape): AtlasCountry => {
      const [[west, south], [east, north]] = geoBounds(shape);
      return { name: shape.properties.name!, shape, bbox: [west, south, east, north] };
    });
  return { detail, land, borders, countries };
}

/** Loads (once) and builds the atlas at the given detail. */
export function loadAtlas(detail: AtlasDetail): Promise<Atlas> {
  let pending = cache.get(detail);
  if (!pending) {
    pending = LOADERS[detail]().then((data) => atlasFromTopology(detail, data));
    // A failed load (offline) may be retried later.
    pending.catch(() => cache.delete(detail));
    cache.set(detail, pending);
  }
  return pending;
}

/** The country at a point, or null over the sea (and in places the atlas leaves out). */
export function countryAt(atlas: Atlas, point: GeoPoint): string | null {
  const lonLat = toLonLat(point);
  for (const country of atlas.countries) {
    if (!inBBox(point, country.bbox)) continue;
    if (geoContains(country.shape, lonLat)) return country.name;
  }
  return null;
}

/** Whether a point is on land (any country, Antarctica included). */
export function isLand(atlas: Atlas, point: GeoPoint): boolean {
  return geoContains(atlas.land, toLonLat(point));
}
