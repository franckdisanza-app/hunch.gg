import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import { regionFrom, type Region } from "./furthest";

// Regions for `pnpm ping:furthest`: a country by its Natural Earth name (from world-atlas's
// 1:10m countries, public domain), or any GeoJSON file of polygons (a continent, a state, the
// contiguous US: see docs/games/ping/content-guide.md for how to make one from Natural Earth).

export interface NamedRegion extends Region {
  name: string;
}

function polygonsOf(geometry: Geometry | null): Position[][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  if (geometry.type === "GeometryCollection") return geometry.geometries.flatMap(polygonsOf);
  return [];
}

function fromGeoJson(data: unknown): Polygon | MultiPolygon {
  const value = data as {
    type?: string;
    features?: { geometry: Geometry | null }[];
    geometry?: Geometry;
  };
  const geometries =
    value.type === "FeatureCollection"
      ? (value.features ?? []).map((f) => f.geometry)
      : value.type === "Feature"
        ? [value.geometry ?? null]
        : [data as Geometry];
  const polygons = geometries.flatMap(polygonsOf);
  if (polygons.length === 0) throw new Error("The GeoJSON holds no polygons.");
  return { type: "MultiPolygon", coordinates: polygons };
}

type Topology = Parameters<typeof feature>[0];
type TopoObject = Exclude<Parameters<typeof feature>[1], string>;

export function loadRegion(root: string, spec: string): NamedRegion {
  if (/\.(geo)?json$/i.test(spec)) {
    const file = existsSync(spec) ? spec : join(root, spec);
    return { name: spec, ...regionFrom(fromGeoJson(JSON.parse(readFileSync(file, "utf8")))) };
  }
  const topology = JSON.parse(
    readFileSync(join(root, "node_modules", "world-atlas", "countries-10m.json"), "utf8"),
  ) as Topology & { objects: { countries: TopoObject } };
  const countries = (
    feature(topology, topology.objects.countries) as unknown as {
      features: { properties: { name?: string }; geometry: Geometry | null }[];
    }
  ).features;
  const wanted = spec.toLocaleLowerCase();
  const match = countries.find((c) => c.properties.name?.toLocaleLowerCase() === wanted);
  if (!match) {
    const close = countries
      .map((c) => c.properties.name ?? "")
      .filter((name) => name.toLocaleLowerCase().includes(wanted.slice(0, 4)))
      .slice(0, 8);
    throw new Error(
      `No country named "${spec}" in Natural Earth.${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`,
    );
  }
  return {
    name: match.properties.name!,
    ...regionFrom(fromGeoJson({ type: "Feature", geometry: match.geometry })),
  };
}
