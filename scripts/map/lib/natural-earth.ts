import {
  MAJOR_ROAD_MAX_ZOOM,
  TILE_DEGREES,
  quantize,
  tileKey,
  type PlaceRecord,
  type RoadRecord,
} from "@/engines/map/overlays";

// The logic behind `pnpm map:data`: Natural Earth's places and roads → the compact records the
// globe reads (src/engines/map/overlays.ts).

export interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export type Position = [number, number];

/** Simplification, in degrees: major roads are drawn at continent scale, tiles closer in. */
const MAJOR_TOLERANCE = 0.04;
const TILE_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------------------------
// Places

export function places(features: Feature[]): PlaceRecord[] {
  const rows = features.flatMap((f) => {
    const p = f.properties;
    const name = String(p.NAME_EN || p.NAME || "").trim();
    if (!name || f.geometry?.type !== "Point") return [];
    const [lon, lat] = f.geometry.coordinates as Position;
    const capital = String(p.FEATURECLA ?? "").startsWith("Admin-0 capital") ? 1 : 0;
    return [
      {
        record: [quantize(lon), quantize(lat), Number(p.MIN_ZOOM), name, capital] as PlaceRecord,
        population: Number(p.POP_MAX) || 0,
      },
    ];
  });
  // Most important first: the order labels are placed in.
  rows.sort((a, b) => a.record[2] - b.record[2] || b.population - a.population);
  return rows.map((r) => r.record);
}

// ---------------------------------------------------------------------------------------------
// Roads

/** Douglas–Peucker in degrees (good enough at this scale): drops points within `tolerance`. */
export function simplify(points: Position[], tolerance: number): Position[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = points[first]!;
    const [bx, by] = points[last]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i]!;
      const distance = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** A line as [minZoom, x0, y0, dx1, dy1, …] in thousandths of a degree, or null if it vanishes. */
export function encode(minZoom: number, points: Position[], id?: number): RoadRecord | null {
  const q = points.map(([lon, lat]) => [quantize(lon), quantize(lat)] as const);
  const out: number[] = id === undefined ? [minZoom] : [id, minZoom];
  let [px, py] = [0, 0];
  for (const [x, y] of q) {
    if (out.length > (id === undefined ? 1 : 2) && x === px && y === py) continue;
    out.push(x - px, y - py);
    [px, py] = [x, y];
  }
  return out.length >= (id === undefined ? 5 : 6) ? (out as RoadRecord) : null;
}

function lines(feature: Feature): Position[][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates as Position[]];
  if (g.type === "MultiLineString") return g.coordinates as Position[][];
  return [];
}

/**
 * Natural Earth cuts roads at every junction: joins pieces of one zoom level that meet end to end
 * (greedily, either way round), so far fewer lines carry their own start point.
 */
export function joinPieces(pieces: Position[][]): Position[][] {
  const key = ([lon, lat]: Position) => `${quantize(lon)},${quantize(lat)}`;
  const ends = new Map<string, number[]>();
  pieces.forEach((piece, i) => {
    for (const point of [piece[0]!, piece.at(-1)!]) {
      const k = key(point);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k)!.push(i);
    }
  });
  const used = new Uint8Array(pieces.length);
  const take = (point: Position, except: number): Position[] | null => {
    for (const i of ends.get(key(point)) ?? []) {
      if (used[i] || i === except) continue;
      used[i] = 1;
      const piece = pieces[i]!;
      return key(piece[0]!) === key(point) ? piece : [...piece].reverse();
    }
    return null;
  };
  const joined: Position[][] = [];
  pieces.forEach((piece, i) => {
    if (used[i]) return;
    used[i] = 1;
    let line = [...piece];
    for (let next = take(line.at(-1)!, i); next; next = take(line.at(-1)!, i)) {
      line = line.concat(next.slice(1));
    }
    for (let previous = take(line[0]!, i); previous; previous = take(line[0]!, i)) {
      line = [...previous].reverse().concat(line.slice(1));
    }
    joined.push(line);
  });
  return joined;
}

/** The tiles a line passes through: those of its points and of points along each segment. */
export function tilesOf(line: Position[]): Set<string> {
  const keys = new Set<string>();
  line.forEach(([lon, lat], i) => {
    keys.add(tileKey(lon, lat));
    const next = line[i + 1];
    if (!next || Math.abs(next[0] - lon) > 180) return;
    const steps = Math.ceil(
      Math.max(Math.abs(next[0] - lon), Math.abs(next[1] - lat)) / (TILE_DEGREES / 4),
    );
    for (let k = 1; k < steps; k++) {
      keys.add(tileKey(lon + ((next[0] - lon) * k) / steps, lat + ((next[1] - lat) * k) / steps));
    }
  });
  return keys;
}

export function roads(features: Feature[]) {
  const byZoom = new Map<number, Position[][]>();
  for (const feature of features) {
    const p = feature.properties;
    // Ferries and tracks are not roads a player would look for.
    if (p.featurecla !== "Road" || p.type === "Ferry Route" || p.type === "Track") continue;
    const minZoom = Number(p.min_zoom);
    if (!byZoom.has(minZoom)) byZoom.set(minZoom, []);
    byZoom.get(minZoom)!.push(...lines(feature));
  }
  const major: RoadRecord[] = [];
  const tiles = new Map<string, RoadRecord[]>();
  let id = 0;
  let points = 0;
  for (const [minZoom, pieces] of [...byZoom].sort((a, b) => a[0] - b[0])) {
    for (const line of joinPieces(pieces)) {
      if (minZoom <= MAJOR_ROAD_MAX_ZOOM) {
        const coarse = encode(minZoom, simplify(line, MAJOR_TOLERANCE));
        if (coarse) major.push(coarse);
      }
      const fine = simplify(line, TILE_TOLERANCE);
      const record = encode(minZoom, fine, id);
      if (!record) continue;
      id++;
      points += fine.length;
      // Every tile the line passes through holds it; the globe drops the duplicates by id.
      for (const key of tilesOf(fine)) {
        if (!tiles.has(key)) tiles.set(key, []);
        tiles.get(key)!.push(record);
      }
    }
  }
  return { major, tiles, lines: id, points };
}
