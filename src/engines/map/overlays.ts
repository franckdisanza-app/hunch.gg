import type { LineString } from "geojson";
import { capOf } from "./atlas";
import { mapZoom, type Camera } from "./camera";
import { normalizeLon, type GeoPoint } from "./geo";

// Cities and roads on the globe, from Natural Earth (public domain), in the files `pnpm map:data`
// writes to public/map/v1/. Nothing loads until the player zooms in: the biggest places first,
// then the rest; major roads for continent-sized views, then 15° tiles of every road closer in.
// Natural Earth gives each place and road the web-map zoom to show it from; mapZoom() (camera.ts)
// turns the globe's zoom and size into that scale.

/** Where the files are served from; the version changes whenever their format does. */
export const MAP_DATA_URL = "/map/v1";

/** [lon, lat] in thousandths of a degree, the map zoom to show it from, its name, 1 for a capital. */
export type PlaceRecord = [number, number, number, string, 0 | 1];
/** Major roads: [minZoom, x0, y0, dx1, dy1, …]; tiles: [id, minZoom, x0, y0, dx1, dy1, …]. */
export type RoadRecord = number[];

/** The two place files, by the map zoom their places show from. */
export const PLACE_TIERS = [
  { file: "places-1.json", maxZoom: 5.1 },
  { file: "places-2.json", maxZoom: Infinity },
] as const;
/** roads.json holds the roads Natural Earth shows from this map zoom or lower. */
export const MAJOR_ROAD_MAX_ZOOM = 4;
export const TILE_DEGREES = 15;

/** When each part loads and shows, in map zoom, plus the globe zoom places wait for. */
export const OVERLAY_ZOOM = {
  /** Places stay off the opening view of the whole world (globe zoom). */
  placesFromGlobeZoom: 1.5,
  /** A place shows once the map zoom reaches its own minimum, less this. */
  placeLead: 0.4,
  /** Major roads from this map zoom… */
  majorRoads: 4,
  /** …and every road, tile by tile, from this one. */
  tiles: 5.5,
  /** A road shows once the map zoom passes its own minimum by this much. */
  roadLag: 0.5,
  /** Requests go out this much before the data is needed. */
  prefetch: 0.4,
} as const;

/** At most this many tiles are fetched for one view. */
const MAX_TILES = 12;

export const quantize = (degrees: number) => Math.round(degrees * 1000);

export function tileKey(lon: number, lat: number): string {
  const col = Math.min(
    360 / TILE_DEGREES - 1,
    Math.floor((normalizeLon(lon) + 180) / TILE_DEGREES),
  );
  const row = Math.min(180 / TILE_DEGREES - 1, Math.floor((lat + 90) / TILE_DEGREES));
  return `${Math.max(0, row)}-${Math.max(0, col)}`;
}

export interface Place {
  point: GeoPoint;
  /** The map zoom it shows from. */
  minZoom: number;
  name: string;
  capital: boolean;
}

export interface RoadLine {
  /** Lines shared by several tiles have one id. */
  id: number;
  minZoom: number;
  line: LineString;
  /** A cap around the line, to skip it when it is out of view. */
  center: [number, number];
  radius: number;
}

export function decodePlaces(records: readonly PlaceRecord[]): Place[] {
  return records.map(([x, y, minZoom, name, capital]) => ({
    point: { lon: x / 1000, lat: y / 1000 },
    minZoom,
    name,
    capital: capital === 1,
  }));
}

/** Decodes delta-encoded roads; `withId` for tile records (which carry an id first). */
export function decodeRoads(records: readonly RoadRecord[], withId: boolean): RoadLine[] {
  return records.map((record, index) => {
    const start = withId ? 2 : 1;
    const coordinates: [number, number][] = [];
    let [x, y] = [0, 0];
    for (let i = start; i + 1 < record.length; i += 2) {
      x += record[i]!;
      y += record[i + 1]!;
      coordinates.push([x / 1000, y / 1000]);
    }
    return {
      id: withId ? record[0]! : index,
      minZoom: record[withId ? 1 : 0]!,
      line: { type: "LineString", coordinates },
      ...capOf(coordinates),
    };
  });
}

const RAD = Math.PI / 180;

/**
 * The tiles a view can show: the box around the cap `angle` radians from the view's centre (the
 * whole band of longitudes when the cap reaches a pole).
 */
export function tilesInView(center: GeoPoint, angle: number): string[] {
  const degrees = angle / RAD;
  const south = Math.max(-90, center.lat - degrees);
  const north = Math.min(90, center.lat + degrees);
  const pole = north >= 89.9 || south <= -89.9;
  const half = pole
    ? 180
    : Math.min(180, Math.asin(Math.min(1, Math.sin(angle) / Math.cos(center.lat * RAD))) / RAD + 1);
  const keys = new Set<string>();
  const step = TILE_DEGREES / 2;
  for (let lat = south; lat <= north + step; lat += step) {
    for (let d = -half; d <= half + step; d += step) {
      keys.add(tileKey(center.lon + Math.min(d, half), Math.min(lat, north)));
    }
  }
  return [...keys];
}

type FetchJson = (url: string) => Promise<unknown>;

const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
};

/**
 * The globe's cities and roads: asks for what the view needs (each file once; a failed request may
 * be retried later) and hands out what has arrived. `onLoad` is called when something new can be
 * drawn.
 */
export class MapOverlays {
  /** Most important first: the order labels are placed in. */
  places: Place[] = [];
  majorRoads: RoadLine[] = [];
  private readonly tiles = new Map<string, RoadLine[]>();
  /** Tiles that have roads at all (roads/index.json). */
  private tileIndex: Set<string> | null = null;
  private readonly requested = new Set<string>();
  private readonly placeTiers: Place[][] = [];

  constructor(
    private readonly onLoad: () => void,
    private readonly load: FetchJson = fetchJson,
  ) {}

  private request(file: string, apply: (data: unknown) => void) {
    if (this.requested.has(file)) return;
    this.requested.add(file);
    this.load(`${MAP_DATA_URL}/${file}`)
      .then((data) => {
        apply(data);
        this.onLoad();
      })
      .catch(() => this.requested.delete(file));
  }

  /** Requests what a view of `camera` in a `width` × `height` box needs. */
  update(camera: Camera, width: number, height: number, viewAngle: number) {
    const zoom = mapZoom(width, height, camera.zoom);
    const ahead = zoom + OVERLAY_ZOOM.prefetch;
    if (camera.zoom >= OVERLAY_ZOOM.placesFromGlobeZoom - 0.2) {
      PLACE_TIERS.forEach((tier, i) => {
        const from = (PLACE_TIERS[i - 1]?.maxZoom ?? -Infinity) - OVERLAY_ZOOM.placeLead;
        if (ahead < from) return;
        this.request(tier.file, (data) => {
          this.placeTiers[i] = decodePlaces(data as PlaceRecord[]);
          this.places = this.placeTiers.flat();
        });
      });
    }
    if (ahead >= OVERLAY_ZOOM.majorRoads) {
      this.request("roads.json", (data) => {
        this.majorRoads = decodeRoads(data as RoadRecord[], false);
      });
    }
    if (ahead >= OVERLAY_ZOOM.tiles) {
      this.request("roads/index.json", (data) => {
        this.tileIndex = new Set(data as string[]);
      });
      if (!this.tileIndex) return;
      const keys = tilesInView(camera.center, viewAngle).filter((k) => this.tileIndex!.has(k));
      for (const key of keys.slice(0, MAX_TILES)) {
        this.request(`roads/${key}.json`, (data) => {
          this.tiles.set(key, decodeRoads(data as RoadRecord[], true));
        });
      }
    }
  }

  /**
   * The roads to draw for a view: every tile's roads once the view is close enough and all its
   * tiles have arrived, the major roads otherwise (or none when zoomed out).
   */
  roads(camera: Camera, width: number, height: number, viewAngle: number): RoadLine[] {
    const zoom = mapZoom(width, height, camera.zoom);
    if (zoom < OVERLAY_ZOOM.majorRoads) return [];
    const shown = (road: RoadLine) => road.minZoom <= zoom - OVERLAY_ZOOM.roadLag;
    if (zoom >= OVERLAY_ZOOM.tiles && this.tileIndex) {
      const keys = tilesInView(camera.center, viewAngle).filter((k) => this.tileIndex!.has(k));
      if (keys.every((k) => this.tiles.has(k))) {
        const seen = new Set<number>();
        const lines: RoadLine[] = [];
        for (const key of keys) {
          for (const road of this.tiles.get(key)!) {
            if (seen.has(road.id) || !shown(road)) continue;
            seen.add(road.id);
            lines.push(road);
          }
        }
        return lines;
      }
    }
    return this.majorRoads.filter(shown);
  }

  /** The places that may show in a view, most important first. */
  placesFor(camera: Camera, width: number, height: number): Place[] {
    if (camera.zoom < OVERLAY_ZOOM.placesFromGlobeZoom) return [];
    const zoom = mapZoom(width, height, camera.zoom) + OVERLAY_ZOOM.placeLead;
    // Sorted by minZoom: stop at the first that waits for a closer view.
    const end = this.places.findIndex((p) => p.minZoom > zoom);
    return end === -1 ? this.places : this.places.slice(0, end);
  }
}
