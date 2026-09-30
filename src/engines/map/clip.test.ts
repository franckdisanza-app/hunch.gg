import type { Polygon } from "geojson";
import { capBox, clipPolygon, clipRing } from "./clip";
import { distanceKm, EARTH_RADIUS_KM } from "./geo";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

describe("clip", () => {
  it("cuts a ring to a box and closes it", () => {
    const ring = clipRing(square.coordinates[0]!, [5, 5, 20, 20]);
    expect(ring[0]).toEqual(ring.at(-1));
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThanOrEqual(5);
      expect(lat).toBeGreaterThanOrEqual(5);
      expect(lon).toBeLessThanOrEqual(10);
      expect(lat).toBeLessThanOrEqual(10);
    }
    // The cut sides are densified: a point at least every degree along them.
    expect(ring.length).toBeGreaterThan(10);
  });

  it("keeps what is inside and drops what is not", () => {
    expect(clipPolygon(square, [-5, -5, 15, 15])?.coordinates[0]).toHaveLength(5);
    expect(clipPolygon(square, [20, 20, 30, 30])).toBeNull();
  });

  it("boxes a view's cap, unless it reaches a pole or the antimeridian", () => {
    const radius = 500 / EARTH_RADIUS_KM;
    const box = capBox([8, 46], radius)!;
    // Every point 500 km from the centre (exact spherical destinations) lies inside the box.
    const rad = Math.PI / 180;
    const [lat1, lon1] = [46 * rad, 8 * rad];
    for (let bearing = 0; bearing < 360; bearing += 15) {
      const t = bearing * rad;
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(radius) + Math.cos(lat1) * Math.sin(radius) * Math.cos(t),
      );
      const lon2 =
        lon1 +
        Math.atan2(
          Math.sin(t) * Math.sin(radius) * Math.cos(lat1),
          Math.cos(radius) - Math.sin(lat1) * Math.sin(lat2),
        );
      const point = { lat: lat2 / rad, lon: lon2 / rad };
      expect(distanceKm(point, { lat: 46, lon: 8 })).toBeCloseTo(500, 6);
      expect(point.lon).toBeGreaterThan(box[0]);
      expect(point.lon).toBeLessThan(box[2]);
      expect(point.lat).toBeGreaterThan(box[1]);
      expect(point.lat).toBeLessThan(box[3]);
    }
    expect(capBox([0, 85], radius)).toBeNull();
    expect(capBox([178, 0], radius)).toBeNull();
  });
});
