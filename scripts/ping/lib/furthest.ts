import type { MultiPolygon, Polygon } from "geojson";
import { around, distance } from "geokdbush";
import KDBush from "kdbush";
import { normalizeLon, scopeSizeKm, type BBox, type GeoPoint } from "@/engines/map/geo";

// The point inside a region that is furthest from every feature (restaurants, roads, the sea):
// the largest empty circle centred in the region. Features outside the region count too: a
// restaurant just across the border can be the nearest one.
//
// Method: a grid over the region (each latitude row filled from its polygon crossings, so the
// region test costs one pass over the edges per row), the nearest feature of every grid point from
// a spatial index (kdbush + geokdbush, haversine on a 6,371 km sphere, like the rest of Plimp),
// then a pattern search from the best grid points with shrinking steps, staying inside the region.

const KM_PER_DEGREE = 111.195;

type Ring = [number, number][];

export interface Region {
  geometry: Polygon | MultiPolygon;
  /** [west, south, east, north]; west > east across the antimeridian. */
  bbox: BBox;
}

export interface FurthestOptions {
  /** Grid spacing; defaults to about a 150th of the region's size, between 0.5 and 25 km. */
  gridKm?: number;
  /** Grid points refined by the pattern search. */
  candidates?: number;
  /** The pattern search stops below this step. */
  toleranceKm?: number;
}

export interface FurthestResult {
  point: GeoPoint;
  /** Distance to the nearest feature. */
  distanceKm: number;
  /** The three nearest features: index into the features list, and distance. */
  nearest: { index: number; km: number }[];
  gridKm: number;
  /** Grid points inside the region that were measured. */
  evaluated: number;
}

/**
 * A region and its bounding box, from its vertices: the box spans the longitudes on the far side
 * of the widest gap between them, so it works across the antimeridian and whatever the rings'
 * winding (GeoJSON files and d3 disagree about it).
 */
export function regionFrom(geometry: Polygon | MultiPolygon): Region {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const points = polygons.flat(2);
  const lats = points.map((p) => p[1]!);
  const lons = [...new Set(points.map((p) => normalizeLon(p[0]!)))].sort((a, b) => a - b);
  let gap = { size: -1, after: 0 };
  lons.forEach((lon, i) => {
    const next = i + 1 < lons.length ? lons[i + 1]! : lons[0]! + 360;
    if (next - lon > gap.size) gap = { size: next - lon, after: i };
  });
  const west = lons[(gap.after + 1) % lons.length]!;
  const east = lons[gap.after]!;
  return { geometry, bbox: [west, Math.min(...lats), east, Math.max(...lats)] };
}

/** Longitude unwrapped to [west, west + 360), so regions across the antimeridian stay contiguous. */
function unwrap(lon: number, west: number): number {
  return west + ((((lon - west) % 360) + 360) % 360);
}

function ringsOf(region: Region): Ring[] {
  const west = region.bbox[0];
  const polygons =
    region.geometry.type === "Polygon"
      ? [region.geometry.coordinates]
      : region.geometry.coordinates;
  return polygons.flatMap((polygon) =>
    polygon.map((ring) =>
      ring.map(([lon, lat]) => [unwrap(lon!, west - 1e-9), lat!] as [number, number]),
    ),
  );
}

/** Even-odd rule: inside when a ray east crosses the rings an odd number of times. */
export function insideRings(rings: readonly Ring[], lon: number, lat: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
  }
  return inside;
}

/** The stretches of a latitude line inside the rings, as [from, to] longitude pairs. */
function rowIntervals(rings: readonly Ring[], lat: number): [number, number][] {
  const crossings: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > lat !== yj > lat) crossings.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    }
  }
  crossings.sort((a, b) => a - b);
  const intervals: [number, number][] = [];
  for (let k = 0; k + 1 < crossings.length; k += 2)
    intervals.push([crossings[k]!, crossings[k + 1]!]);
  return intervals;
}

export function featureIndex(features: readonly GeoPoint[]): KDBush {
  const index = new KDBush(Math.max(1, features.length));
  for (const f of features) index.add(normalizeLon(f.lon), f.lat);
  return index.finish();
}

function nearestOf(index: KDBush, features: readonly GeoPoint[], point: GeoPoint, count = 1) {
  const lon = normalizeLon(point.lon);
  return around(index, lon, point.lat, count).map((i) => ({
    index: i,
    km: distance(lon, point.lat, normalizeLon(features[i]!.lon), features[i]!.lat),
  }));
}

/** Moves `km` from a point along a bearing (degrees, clockwise from north), for small steps. */
function step(point: GeoPoint, km: number, bearing: number): GeoPoint {
  const rad = (bearing * Math.PI) / 180;
  const lat = point.lat + (km * Math.cos(rad)) / KM_PER_DEGREE;
  const cos = Math.max(0.01, Math.cos((point.lat * Math.PI) / 180));
  return {
    lat: Math.max(-90, Math.min(90, lat)),
    lon: point.lon + (km * Math.sin(rad)) / (KM_PER_DEGREE * cos),
  };
}

export function furthestPoint(
  region: Region,
  features: readonly GeoPoint[],
  options: FurthestOptions = {},
): FurthestResult {
  if (features.length === 0) throw new Error("No features to measure against.");
  const rings = ringsOf(region);
  const [west, south, , north] = region.bbox;
  const gridKm = options.gridKm ?? Math.min(25, Math.max(0.5, scopeSizeKm(region.bbox) / 150));
  const keep = options.candidates ?? 25;
  const tolerance = options.toleranceKm ?? 0.01;
  const index = featureIndex(features);
  const measure = (p: GeoPoint) => nearestOf(index, features, p)[0]!.km;
  const inside = (p: GeoPoint) => insideRings(rings, unwrap(p.lon, west - 1e-9), p.lat);

  // The grid, keeping the `keep` best points.
  let evaluated = 0;
  const best: { point: GeoPoint; km: number }[] = [];
  const dLat = gridKm / KM_PER_DEGREE;
  for (let lat = south + dLat / 2; lat < north; lat += dLat) {
    const dLon = gridKm / (KM_PER_DEGREE * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
    for (const [from, to] of rowIntervals(rings, lat)) {
      for (let lon = from + Math.min(dLon, to - from) / 2; lon < to; lon += dLon) {
        const point = { lat, lon: normalizeLon(lon) };
        const km = measure(point);
        evaluated++;
        if (best.length < keep || km > best[best.length - 1]!.km) {
          best.push({ point, km });
          best.sort((a, b) => b.km - a.km);
          if (best.length > keep) best.pop();
        }
      }
    }
  }
  if (best.length === 0)
    throw new Error("The region is smaller than one grid cell: use a smaller --grid-km.");

  // Pattern search from each candidate: move to the best neighbour inside the region, halve the
  // step when none improves.
  let winner = best[0]!;
  for (const start of best) {
    let current = start;
    let size = gridKm;
    while (size > tolerance) {
      let moved = false;
      for (let bearing = 0; bearing < 360; bearing += 45) {
        const point = step(current.point, size, bearing);
        if (!inside(point)) continue;
        const km = measure(point);
        if (km > current.km + 1e-9) {
          current = { point: { lat: point.lat, lon: normalizeLon(point.lon) }, km };
          moved = true;
        }
      }
      if (!moved) size /= 2;
    }
    if (current.km > winner.km) winner = current;
  }

  return {
    point: winner.point,
    distanceKm: winner.km,
    nearest: nearestOf(index, features, winner.point, 3),
    gridKm,
    evaluated,
  };
}

/** A box grown by `km` on every side (for fetching features just outside the region). */
export function expandBBox([west, south, east, north]: BBox, km: number): BBox {
  const dLat = km / KM_PER_DEGREE;
  const s = Math.max(-90, south - dLat);
  const n = Math.min(90, north + dLat);
  const widest = Math.max(Math.abs(s), Math.abs(n));
  const dLon = km / (KM_PER_DEGREE * Math.max(0.01, Math.cos((widest * Math.PI) / 180)));
  const span = (((east - west) % 360) + 360) % 360 || 360;
  if (span + 2 * dLon >= 360 || widest > 89) return [-180, s, 180, n];
  return [normalizeLon(west - dLon), s, normalizeLon(east + dLon), n];
}
