import { geoCircle, geoDistance } from "d3-geo";
import type { LineString, Polygon } from "geojson";
import { UI_LOCALE } from "@/lib/locale";
import { formatNumber } from "@/lib/format";

// Geometry on the sphere for map games: distances, nearest targets, circles, scope sizes and
// units. Pure functions over { lat, lon } in degrees. Everything goes through d3-geo's spherical
// maths, so the antimeridian and the poles need no special cases.

/** A point on the globe, in degrees. Longitudes may be outside ±180 (they are normalised). */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** [west, south, east, north] in degrees. West > east when the box crosses the antimeridian. */
export type BBox = readonly [number, number, number, number];

/** Mean Earth radius (IUGG), the radius great-circle distances are measured on. */
export const EARTH_RADIUS_KM = 6371;

/** The farthest apart two places can be: half the circumference, about 20,015 km. */
export const MAX_DISTANCE_KM = Math.PI * EARTH_RADIUS_KM;

export const KM_PER_MILE = 1.609344;

/** Wraps a longitude into [-180, 180). */
export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/** d3-geo's [longitude, latitude] order. */
export function toLonLat(point: GeoPoint): [number, number] {
  return [normalizeLon(point.lon), clampLat(point.lat)];
}

export function fromLonLat([lon, lat]: readonly [number, number]): GeoPoint {
  return { lat: clampLat(lat), lon: normalizeLon(lon) };
}

/** Great-circle distance in km. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  return geoDistance(toLonLat(a), toLonLat(b)) * EARTH_RADIUS_KM;
}

/** The target nearest to `point` and how far it is. Ties go to the earlier target. */
export function nearestTarget(
  point: GeoPoint,
  targets: readonly GeoPoint[],
): { index: number; km: number } {
  if (targets.length === 0) throw new Error("nearestTarget needs at least one target.");
  let best = { index: 0, km: Infinity };
  targets.forEach((target, index) => {
    const km = distanceKm(point, target);
    if (km < best.km) best = { index, km };
  });
  return best;
}

export function kmToDegrees(km: number): number {
  return (km / EARTH_RADIUS_KM) * (180 / Math.PI);
}

/**
 * Every point `radiusKm` from `center`, as a GeoJSON polygon (a small circle on the sphere). d3-geo
 * clips and projects it correctly across the antimeridian, around the poles and past a
 * hemisphere. `precision` is the step between vertices in degrees.
 */
export function geodesicCircle(center: GeoPoint, radiusKm: number, precision = 2): Polygon {
  // A radius of half the circumference would collapse onto the antipode.
  const radius = Math.min(Math.max(kmToDegrees(radiusKm), 1e-6), 179.999);
  return geoCircle().center(toLonLat(center)).radius(radius).precision(precision)();
}

/** A great-circle arc from `a` to `b` (d3-geo draws LineStrings along great circles). */
export function greatCircleArc(a: GeoPoint, b: GeoPoint): LineString {
  return { type: "LineString", coordinates: [toLonLat(a), toLonLat(b)] };
}

type Vec3 = [number, number, number];
const RAD = Math.PI / 180;

function toVector(point: GeoPoint): Vec3 {
  const lat = point.lat * RAD;
  const lon = point.lon * RAD;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function fromVector([x, y, z]: Vec3): GeoPoint {
  return { lat: Math.asin(Math.max(-1, Math.min(1, z))) / RAD, lon: Math.atan2(y, x) / RAD };
}

/**
 * Where two circles on the sphere cross (0, 1 or 2 points): the places `r1Km` from `c1` and `r2Km`
 * from `c2`. Two exact distances pin an answer down to these points, so games can light them up.
 */
export function circleIntersections(
  c1: GeoPoint,
  r1Km: number,
  c2: GeoPoint,
  r2Km: number,
): GeoPoint[] {
  const a1 = toVector(c1);
  const a2 = toVector(c2);
  const cosD = a1[0] * a2[0] + a1[1] * a2[1] + a1[2] * a2[2];
  const sin2D = 1 - cosD * cosD;
  // The same or opposite centres: the circles coincide or never cross.
  if (sin2D < 1e-12) return [];
  const cos1 = Math.cos(r1Km / EARTH_RADIUS_KM);
  const cos2 = Math.cos(r2Km / EARTH_RADIUS_KM);
  const a = (cos1 - cos2 * cosD) / sin2D;
  const b = (cos2 - cos1 * cosD) / sin2D;
  const t2 = (1 - (a * a + b * b + 2 * a * b * cosD)) / sin2D;
  if (t2 < -1e-12) return [];
  const n: Vec3 = [
    a1[1] * a2[2] - a1[2] * a2[1],
    a1[2] * a2[0] - a1[0] * a2[2],
    a1[0] * a2[1] - a1[1] * a2[0],
  ];
  const base: Vec3 = [a * a1[0] + b * a2[0], a * a1[1] + b * a2[1], a * a1[2] + b * a2[2]];
  const t = Math.sqrt(Math.max(0, t2));
  const point = (sign: number) =>
    fromVector([base[0] + sign * t * n[0], base[1] + sign * t * n[1], base[2] + sign * t * n[2]]);
  return t < 1e-9 ? [point(1)] : [point(1), point(-1)];
}

/** Longitudes a bounding box spans, in degrees (0–360), antimeridian-safe. */
export function bboxLonSpan([west, , east]: BBox): number {
  const span = (((east - west) % 360) + 360) % 360;
  // [-180, …, 180, …] wraps to 0 but means every longitude.
  return span === 0 && west !== east ? 360 : span;
}

/** Whether `point` lies inside a bounding box, including boxes across the antimeridian. */
export function inBBox(point: GeoPoint, bbox: BBox): boolean {
  const [west, south, , north] = bbox;
  if (point.lat < south || point.lat > north) return false;
  const offset = (((point.lon - west) % 360) + 360) % 360;
  return offset <= bboxLonSpan(bbox);
}

/** The centre of a bounding box, antimeridian-safe. */
export function bboxCenter(bbox: BBox): GeoPoint {
  const [west, south, , north] = bbox;
  return { lat: (south + north) / 2, lon: normalizeLon(west + bboxLonSpan(bbox) / 2) };
}

/**
 * How big an area is: the largest great-circle distance between points on the outline of its
 * bounding box (its diameter, near enough). A map game measures misses against it, so a 100 km
 * miss counts for little on the world and for a lot in a small country. Without a box: the world.
 */
export function scopeSizeKm(bbox?: BBox): number {
  if (!bbox) return MAX_DISTANCE_KM;
  const [west, south, , north] = bbox;
  const span = bboxLonSpan(bbox);
  const steps = 8;
  const outline: GeoPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const lon = west + (span * i) / steps;
    outline.push({ lat: south, lon }, { lat: north, lon });
  }
  for (let i = 1; i < steps; i++) {
    const lat = south + ((north - south) * i) / steps;
    outline.push({ lat, lon: west }, { lat, lon: west + span });
  }
  let max = 0;
  for (let i = 0; i < outline.length; i++) {
    for (let j = i + 1; j < outline.length; j++) {
      max = Math.max(max, distanceKm(outline[i]!, outline[j]!));
    }
  }
  return max;
}

// ---------------------------------------------------------------------------------------------
// Units

export type DistanceUnit = "km" | "mi";

/** Regions whose road signs are in miles; everywhere else gets kilometres. */
const MILE_REGIONS = new Set([
  "US",
  "GB",
  "LR",
  "MM",
  "PR",
  "GU",
  "VI",
  "AS",
  "MP",
  "IM",
  "JE",
  "GG",
]);

/**
 * The distance unit for a BCP 47 locale, e.g. "en-US" → mi, "de-CH" → km. A locale without a
 * region is resolved to its likely region ("en" → US). Unknown or invalid locales get km.
 */
export function unitForLocale(locale: string | undefined): DistanceUnit {
  if (!locale) return "km";
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region && MILE_REGIONS.has(region) ? "mi" : "km";
  } catch {
    return "km";
  }
}

export function convertKm(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? km / KM_PER_MILE : km;
}

/**
 * "1,234 km", "767 mi", "4.2 km": one decimal under 10, whole numbers above. Uses Intl unit
 * formatting in the UI locale, so no strings live here.
 */
export function formatDistance(km: number, unit: DistanceUnit, locale: string = UI_LOCALE): string {
  const value = convertKm(km, unit);
  return formatNumber(value, locale, {
    style: "unit",
    unit: unit === "mi" ? "mile" : "kilometer",
    unitDisplay: "short",
    maximumFractionDigits: value < 10 ? 1 : 0,
  });
}

/** "46.52° N, 7.96° E": coordinates for readouts and screen readers, two decimals. */
export function formatLatLon(
  point: GeoPoint,
  letters: { n: string; s: string; e: string; w: string },
  locale: string = UI_LOCALE,
): string {
  const lon = normalizeLon(point.lon);
  const deg = (value: number) =>
    formatNumber(Math.abs(value), locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lat = `${deg(point.lat)}° ${point.lat >= 0 ? letters.n : letters.s}`;
  const lng = `${deg(lon)}° ${lon >= 0 ? letters.e : letters.w}`;
  return `${lat}, ${lng}`;
}
