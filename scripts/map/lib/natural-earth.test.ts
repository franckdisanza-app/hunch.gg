import { decodePlaces, decodeRoads, tileKey } from "@/engines/map/overlays";
import {
  encode,
  joinPieces,
  places,
  roads,
  simplify,
  tilesOf,
  type Feature,
  type Position,
} from "./natural-earth";

// Fake features only: made-up names and places, shaped like Natural Earth's.

function place(name: string, lon: number, lat: number, minZoom: number, extra = {}): Feature {
  return {
    properties: { NAME: name, NAME_EN: name, MIN_ZOOM: minZoom, POP_MAX: 1000, ...extra },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

function road(coordinates: Position[], minZoom: number, type = "Road"): Feature {
  return {
    properties: {
      featurecla: type.startsWith("Ferry") ? "Ferry" : "Road",
      type,
      min_zoom: minZoom,
    },
    geometry: { type: "LineString", coordinates },
  };
}

describe("places", () => {
  it("puts the most important first and marks capitals", () => {
    const rows = places([
      place("Fake Village", 1, 1, 7),
      place("Fake Town", 2, 2, 5, { POP_MAX: 10 }),
      place("Fake City", 3, 3, 5, { POP_MAX: 500_000 }),
      place("Fake Capital", 4.5, 4.25, 3, { FEATURECLA: "Admin-0 capital" }),
      place("", 5, 5, 3),
    ]);
    expect(rows.map((r) => r[3])).toEqual([
      "Fake Capital",
      "Fake City",
      "Fake Town",
      "Fake Village",
    ]);
    expect(decodePlaces(rows)[0]).toEqual({
      point: { lon: 4.5, lat: 4.25 },
      minZoom: 3,
      name: "Fake Capital",
      capital: true,
    });
  });
});

describe("roads", () => {
  it("drops points closer to the line than the tolerance, never the ends or a corner", () => {
    const line: Position[] = [
      [0, 0],
      [1, 0.001],
      [2, 0],
      [3, 1],
    ];
    expect(simplify(line, 0.01)).toEqual([
      [0, 0],
      [2, 0],
      [3, 1],
    ]);
  });

  it("encodes lines as deltas the globe decodes back", () => {
    const line: Position[] = [
      [10.5, 20.25],
      [10.6, 20.3],
      [-170, -5],
    ];
    const [plain] = decodeRoads([encode(4, line)!], false);
    expect(plain!.minZoom).toBe(4);
    expect(plain!.line.coordinates).toEqual(line);
    const [tiled] = decodeRoads([encode(6, line, 42)!], true);
    expect(tiled).toMatchObject({ id: 42, minZoom: 6 });
    expect(tiled!.line.coordinates).toEqual(line);
    // A line that collapses to one point is dropped.
    expect(
      encode(4, [
        [1, 1],
        [1.0001, 1],
      ]),
    ).toBeNull();
  });

  it("joins pieces that meet end to end, either way round", () => {
    const joined = joinPieces([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [2, 0],
        [1, 0],
      ],
      [
        [5, 5],
        [6, 6],
      ],
    ]);
    expect(joined).toEqual([
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [5, 5],
        [6, 6],
      ],
    ]);
  });

  it("files a long segment under every tile it crosses", () => {
    const keys = tilesOf([
      [1, 1],
      [44, 1],
    ]);
    expect(keys).toEqual(new Set([tileKey(1, 1), tileKey(20, 1), tileKey(35, 1)]));
  });

  it("keeps roads, not ferries, with major ones in their own simplified set", () => {
    const { major, tiles, lines } = roads([
      road(
        [
          [0, 0],
          [1, 1],
        ],
        3,
      ),
      road(
        [
          [1, 1],
          [2, 1],
        ],
        3,
      ),
      road(
        [
          [5, 5],
          [6, 5],
        ],
        7,
      ),
      road(
        [
          [7, 7],
          [8, 8],
        ],
        3,
        "Ferry Route",
      ),
    ]);
    // The two zoom-3 pieces join into one major road; the zoom-7 one is only in the tiles.
    expect(major).toHaveLength(1);
    expect(lines).toBe(2);
    expect([...tiles.values()].flat()).toHaveLength(2);
  });
});
