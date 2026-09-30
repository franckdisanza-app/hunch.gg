import type { Polygon, Position } from "geojson";

// Flat clipping in longitude/latitude, to keep zoomed-in frames cheap: a continent at 1:50m has
// ten thousand points, and d3-geo projects and clips every one of them on the sphere. Cut to the
// box around what the view shows first (a few multiplications per point), and only the visible
// stretch reaches d3. The cut edges lie outside the view; they are densified so d3 (which joins
// points along great circles) keeps them there.

/** [west, south, east, north] with west < east (never across the antimeridian). */
export type ViewBox = readonly [number, number, number, number];

/** Clips a closed ring to a box (Sutherland–Hodgman). Returns a closed ring, or [] if nothing is left. */
export function clipRing(
  ring: readonly Position[],
  [west, south, east, north]: ViewBox,
): Position[] {
  let out: Position[] = ring.slice(0, -1);
  const pass = (
    inside: (p: Position) => boolean,
    cross: (a: Position, b: Position) => Position,
  ) => {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i]!;
      const previous = input[(i + input.length - 1) % input.length]!;
      if (inside(current)) {
        if (!inside(previous)) out.push(cross(previous, current));
        out.push(current);
      } else if (inside(previous)) {
        out.push(cross(previous, current));
      }
    }
  };
  const atLon = (a: Position, b: Position, lon: number): Position => [
    lon,
    a[1]! + ((b[1]! - a[1]!) * (lon - a[0]!)) / (b[0]! - a[0]!),
  ];
  const atLat = (a: Position, b: Position, lat: number): Position => [
    a[0]! + ((b[0]! - a[0]!) * (lat - a[1]!)) / (b[1]! - a[1]!),
    lat,
  ];
  pass(
    (p) => p[0]! >= west,
    (a, b) => atLon(a, b, west),
  );
  if (out.length)
    pass(
      (p) => p[0]! <= east,
      (a, b) => atLon(a, b, east),
    );
  if (out.length)
    pass(
      (p) => p[1]! >= south,
      (a, b) => atLat(a, b, south),
    );
  if (out.length)
    pass(
      (p) => p[1]! <= north,
      (a, b) => atLat(a, b, north),
    );
  if (out.length < 3) return [];
  return densifyEdges([...out, out[0]!], [west, south, east, north]);
}

/** Adds points every degree along stretches that run on the box's sides. */
function densifyEdges(ring: Position[], [west, south, east, north]: ViewBox): Position[] {
  const onSide = (a: Position, b: Position) =>
    (a[0] === west && b[0] === west) ||
    (a[0] === east && b[0] === east) ||
    (a[1] === south && b[1] === south) ||
    (a[1] === north && b[1] === north);
  const out: Position[] = [ring[0]!];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!;
    const b = ring[i]!;
    if (onSide(a, b)) {
      const steps = Math.floor(Math.max(Math.abs(b[0]! - a[0]!), Math.abs(b[1]! - a[1]!)));
      for (let k = 1; k < steps; k++) {
        out.push([a[0]! + ((b[0]! - a[0]!) * k) / steps, a[1]! + ((b[1]! - a[1]!) * k) / steps]);
      }
    }
    out.push(b);
  }
  return out;
}

/** A polygon cut to a box (holes too), or null when none of it is inside. */
export function clipPolygon(polygon: Polygon, box: ViewBox): Polygon | null {
  const [outer, ...holes] = polygon.coordinates;
  const ring = clipRing(outer ?? [], box);
  if (ring.length === 0) return null;
  const inner = holes.map((hole) => clipRing(hole, box)).filter((r) => r.length > 0);
  return { type: "Polygon", coordinates: [ring, ...inner] };
}

const RAD = Math.PI / 180;

/**
 * The longitude/latitude box around a spherical cap (the part of the globe a view can show), with
 * a margin; null when it reaches a pole or crosses the antimeridian (draw without clipping then).
 */
export function capBox(
  center: readonly [number, number],
  radius: number,
  margin = 2,
): ViewBox | null {
  const [lon, lat] = center;
  const r = radius / RAD + margin;
  const south = lat - r;
  const north = lat + r;
  if (south <= -89 || north >= 89) return null;
  const halfWidth =
    Math.asin(Math.min(1, Math.sin(Math.min(radius, Math.PI / 2)) / Math.cos(lat * RAD))) / RAD +
    margin;
  const west = lon - halfWidth;
  const east = lon + halfWidth;
  if (west < -180 || east > 180) return null;
  return [west, south, east, north];
}
