import { geoContains, geoDistance } from "d3-geo";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { feature, mesh } from "topojson-client";
import { inBBox, toLonLat, type BBox, type GeoPoint } from "./geo";

// Land and country shapes from world-atlas (Natural Earth, public domain), loaded on demand: the
// 1:110m set right after the globe first draws, the 1:50m set once the player zooms in. Each is
// its own chunk, so no page pays for the map until it shows a globe. In the browser the shapes
// are built a step at a time (loadAtlas yields between steps), and countries only when a screen
// reader first asks where the crosshair is, so no single task blocks the page for long. Land and
// borders are kept in pieces with bounding caps, so a frame draws only what can show.

export type AtlasDetail = "110m" | "50m";

export interface AtlasCountry {
  name: string;
  shape: Feature<Polygon | MultiPolygon>;
  /** [west, south, east, north], to skip most countries before the exact test. */
  bbox: BBox;
}

/** A piece of the map and a cap on the sphere that contains it. */
export interface MapPart<G extends Polygon | LineString> {
  geometry: G;
  /** [longitude, latitude] of the cap's centre. */
  center: [number, number];
  /** The cap's angular radius, in radians. */
  radius: number;
  /** How many points it has (big ones are worth clipping before projection). */
  points: number;
}

export type LandPart = MapPart<Polygon>;
export type BorderPart = MapPart<LineString>;

export interface Atlas {
  detail: AtlasDetail;
  land: Feature<MultiPolygon>;
  /** The land, polygon by polygon. */
  parts: LandPart[];
  /** Borders between countries (not coastlines). */
  borders: MultiLineString;
  /** The borders in short pieces. */
  borderParts: BorderPart[];
  /** Named countries, built on first use. */
  readonly countries: AtlasCountry[];
}

type Topology = Parameters<typeof feature>[0];
type TopoObject = Exclude<Parameters<typeof feature>[1], string>;
type CountriesTopology = Topology & { objects: { countries: TopoObject; land: TopoObject } };

// Typed as unknown on purpose: letting TypeScript infer the type of a 750 KB JSON file is slow.
const LOADERS: Record<AtlasDetail, () => Promise<unknown>> = {
  "110m": () => import("world-atlas/countries-110m.json").then((m) => m.default as unknown),
  "50m": () => import("world-atlas/countries-50m.json").then((m) => m.default as unknown),
};

const cache = new Map<AtlasDetail, Promise<Atlas>>();
const RAD = Math.PI / 180;

/** Border lines are cut into pieces of at most this many points. */
const BORDER_PIECE = 200;

/** Lets the browser breathe between steps, so building an atlas never blocks for long. */
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function polygonsOf(geometry: Polygon | MultiPolygon): Polygon["coordinates"][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/**
 * A quick bounding box from the coordinates. Shapes that reach across the antimeridian (Russia,
 * Fiji) span almost 360° this way: they get every longitude, and geoContains decides.
 */
function quickBBox(geometry: Polygon | MultiPolygon): BBox {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygonsOf(geometry)) {
    for (const [lon, lat] of polygon[0] ?? []) {
      west = Math.min(west, lon!);
      east = Math.max(east, lon!);
      south = Math.min(south, lat!);
      north = Math.max(north, lat!);
    }
  }
  return east - west > 180 ? [-180, south, 180, north] : [west, south, east, north];
}

/** A cap around some points: centred on their mean direction, reaching the farthest one. */
function capOf(points: readonly Position[]): { center: [number, number]; radius: number } {
  let [x, y, z] = [0, 0, 0];
  for (const [lon, lat] of points) {
    const phi = lat! * RAD;
    const lambda = lon! * RAD;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) return { center: [0, 0], radius: Math.PI };
  const center: [number, number] = [Math.atan2(y, x) / RAD, Math.asin(z / length) / RAD];
  let radius = 0;
  for (const p of points) radius = Math.max(radius, geoDistance(center, p as [number, number]));
  return { center, radius };
}

function landPart(coordinates: Polygon["coordinates"]): LandPart {
  return {
    geometry: { type: "Polygon", coordinates },
    ...capOf(coordinates[0] ?? []),
    points: coordinates.reduce((sum, ring) => sum + ring.length, 0),
  };
}

function borderPartsOf(borders: MultiLineString): BorderPart[] {
  const parts: BorderPart[] = [];
  for (const line of borders.coordinates) {
    // Pieces overlap by one point, so a border stays unbroken.
    for (let i = 0; i < line.length - 1; i += BORDER_PIECE) {
      const coordinates = line.slice(i, i + BORDER_PIECE + 1);
      parts.push({
        geometry: { type: "LineString", coordinates },
        ...capOf(coordinates),
        points: coordinates.length,
      });
    }
  }
  return parts;
}

function countriesOf(topology: CountriesTopology): AtlasCountry[] {
  const collection = feature(topology, topology.objects.countries) as unknown as {
    features: Feature<Polygon | MultiPolygon, { name?: string }>[];
  };
  return collection.features
    .filter((f) => f.geometry && f.properties?.name)
    .map((shape) => ({ name: shape.properties.name!, shape, bbox: quickBBox(shape.geometry) }));
}

function bordersOf(topology: CountriesTopology): MultiLineString {
  return mesh(
    topology,
    topology.objects.countries as NonNullable<Parameters<typeof mesh>[1]>,
    (a, b) => a !== b,
  );
}

/** All land as one MultiPolygon feature (world-atlas stores it as a collection of one). */
function landOf(topology: CountriesTopology): Feature<MultiPolygon> {
  const result = feature(topology, topology.objects.land) as unknown as
    Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;
  const features = "features" in result ? result.features : [result];
  const coordinates = features.flatMap((f) => polygonsOf(f.geometry));
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates } };
}

function assemble(
  detail: AtlasDetail,
  topology: CountriesTopology,
  land: Feature<MultiPolygon>,
  parts: LandPart[],
  borders: MultiLineString,
  borderParts: BorderPart[],
): Atlas {
  let countries: AtlasCountry[] | null = null;
  return {
    detail,
    land,
    parts,
    borders,
    borderParts,
    get countries() {
      countries ??= countriesOf(topology);
      return countries;
    },
  };
}

/** Builds an atlas from a world-atlas countries topology, in one go (scripts, tests, images). */
export function atlasFromTopology(detail: AtlasDetail, data: unknown): Atlas {
  const topology = data as CountriesTopology;
  const land = landOf(topology);
  const borders = bordersOf(topology);
  return assemble(
    detail,
    topology,
    land,
    polygonsOf(land.geometry).map(landPart),
    borders,
    borderPartsOf(borders),
  );
}

/** The same, a step at a time, yielding to the browser in between. */
async function buildAtlas(detail: AtlasDetail, data: unknown): Promise<Atlas> {
  const topology = data as CountriesTopology;
  await pause();
  const land = landOf(topology);
  const polygons = polygonsOf(land.geometry);
  const parts: LandPart[] = [];
  for (let i = 0; i < polygons.length; i += 150) {
    await pause();
    parts.push(...polygons.slice(i, i + 150).map(landPart));
  }
  await pause();
  const borders = bordersOf(topology);
  await pause();
  return assemble(detail, topology, land, parts, borders, borderPartsOf(borders));
}

/** Loads (once) and builds the atlas at the given detail. */
export function loadAtlas(detail: AtlasDetail): Promise<Atlas> {
  let pending = cache.get(detail);
  if (!pending) {
    pending = LOADERS[detail]().then((data) => buildAtlas(detail, data));
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
