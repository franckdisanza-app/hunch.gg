import { mapZoom, viewAngle, type Camera } from "./camera";
import {
  MAP_DATA_URL,
  MapOverlays,
  OVERLAY_ZOOM,
  tileKey,
  tilesInView,
  type PlaceRecord,
  type RoadRecord,
} from "./overlays";

// Made-up places and roads: the shapes of the files `pnpm map:data` writes, nothing real.

const W = 400;
const H = 400;

/** A camera over a point at the given map zoom, for a W × H view. */
function at(lat: number, lon: number, zoom: number): Camera {
  const globeZoom = 2 ** (zoom - mapZoom(W, H, 1));
  return { center: { lat, lon }, zoom: globeZoom };
}

const PLACES_1: PlaceRecord[] = [
  [10_000, 50_000, 2, "Fake Capital", 1],
  [11_000, 51_000, 5, "Fake City", 0],
];
const PLACES_2: PlaceRecord[] = [[12_000, 50_500, 7, "Fake Village", 0]];
const MAJOR: RoadRecord[] = [[3, 10_000, 50_000, 1000, 1000]];
const tileRoad = (id: number, minZoom: number): RoadRecord => [
  id,
  minZoom,
  10_000,
  50_000,
  100,
  100,
];

function fakeServer(files: Record<string, unknown>) {
  const asked: string[] = [];
  const pending: (() => void)[] = [];
  const load = (url: string) => {
    asked.push(url.replace(`${MAP_DATA_URL}/`, ""));
    return new Promise<unknown>((resolve, reject) => {
      pending.push(() => {
        const file = url.replace(`${MAP_DATA_URL}/`, "");
        if (file in files) resolve(files[file]);
        else reject(new Error("404"));
      });
    });
  };
  const flush = async () => {
    while (pending.length) pending.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { asked, load, flush };
}

describe("tiles", () => {
  it("names 15° tiles by row and column, wrapping longitudes", () => {
    expect(tileKey(-180, -90)).toBe("0-0");
    expect(tileKey(180, 0)).toBe("6-0");
    expect(tileKey(179.9, 90)).toBe("11-23");
    expect(tileKey(10, 50)).toBe("9-12");
  });

  it("finds the tiles around a view, and every column near a pole", () => {
    const europe = tilesInView({ lat: 50, lon: 10 }, viewAngle(W, H, at(50, 10, 7).zoom));
    expect(europe).toContain("9-12");
    expect(europe.length).toBeLessThanOrEqual(4);
    const arctic = tilesInView({ lat: 85, lon: 0 }, 0.2);
    expect(new Set(arctic.map((k) => k.split("-")[1])).size).toBe(24);
  });
});

describe("MapOverlays", () => {
  const files = {
    "places-1.json": PLACES_1,
    "places-2.json": PLACES_2,
    "roads.json": MAJOR,
    "roads/index.json": ["9-12"],
    "roads/9-12.json": [tileRoad(1, 4), tileRoad(2, 6), tileRoad(2, 6)],
  };

  it("asks for nothing on the opening view, then more as the player zooms in", async () => {
    const server = fakeServer(files);
    const onLoad = vi.fn();
    const overlays = new MapOverlays(onLoad, server.load);
    const update = (camera: Camera) => overlays.update(camera, W, H, viewAngle(W, H, camera.zoom));

    update({ center: { lat: 50, lon: 10 }, zoom: 1 });
    expect(server.asked).toEqual([]);

    update(at(50, 10, OVERLAY_ZOOM.majorRoads - 1));
    expect(server.asked).toEqual(["places-1.json"]);

    update(at(50, 10, OVERLAY_ZOOM.tiles));
    expect(server.asked).toEqual([
      "places-1.json",
      "places-2.json",
      "roads.json",
      "roads/index.json",
    ]);
    await server.flush();
    expect(onLoad).toHaveBeenCalled();
    // The index has arrived: now the tile in view.
    update(at(50, 10, OVERLAY_ZOOM.tiles));
    expect(server.asked.at(-1)).toBe("roads/9-12.json");
    // Each file once.
    update(at(50, 10, OVERLAY_ZOOM.tiles));
    expect(new Set(server.asked).size).toBe(server.asked.length);
  });

  it("draws major roads until the tiles in view arrive, then their roads, once each", async () => {
    const server = fakeServer(files);
    const overlays = new MapOverlays(() => {}, server.load);
    const camera = at(50, 10, 7);
    const angle = viewAngle(W, H, camera.zoom);
    overlays.update(camera, W, H, angle);
    await server.flush();
    expect(overlays.roads(camera, W, H, angle)).toEqual(overlays.majorRoads);
    overlays.update(camera, W, H, angle);
    await server.flush();
    expect(overlays.roads(camera, W, H, angle).map((r) => r.id)).toEqual([1, 2]);
    // Zoomed out to continent size: the major roads again; further out, none.
    const continent = at(50, 10, OVERLAY_ZOOM.majorRoads + 0.6);
    expect(overlays.roads(continent, W, H, viewAngle(W, H, continent.zoom))).toHaveLength(1);
    const world = { center: { lat: 50, lon: 10 }, zoom: 1 };
    expect(overlays.roads(world, W, H, viewAngle(W, H, 1))).toEqual([]);
  });

  it("shows places from their own zoom, most important first", async () => {
    const server = fakeServer(files);
    const overlays = new MapOverlays(() => {}, server.load);
    const close = at(50, 10, 7);
    overlays.update(close, W, H, viewAngle(W, H, close.zoom));
    await server.flush();
    expect(overlays.placesFor(close, W, H).map((p) => p.name)).toEqual([
      "Fake Capital",
      "Fake City",
      "Fake Village",
    ]);
    expect(overlays.placesFor(at(50, 10, 3), W, H).map((p) => p.name)).toEqual(["Fake Capital"]);
  });

  it("asks again for a file that failed", async () => {
    const server = fakeServer({});
    const overlays = new MapOverlays(() => {}, server.load);
    const camera = at(50, 10, 3);
    overlays.update(camera, W, H, viewAngle(W, H, camera.zoom));
    await server.flush();
    overlays.update(camera, W, H, viewAngle(W, H, camera.zoom));
    expect(server.asked).toEqual(["places-1.json", "places-1.json"]);
  });
});
