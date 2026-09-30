import type { Polygon } from "geojson";
import { distanceKm, type GeoPoint } from "@/engines/map/geo";
import { expandBBox, furthestPoint, insideRings, regionFrom } from "./furthest";

// Synthetic regions and features with answers known from geometry: nothing real here.

function box(west: number, south: number, east: number, north: number): Polygon {
  // Counter-clockwise, as GeoJSON and d3-geo expect for a small polygon.
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

describe("furthestPoint", () => {
  it("finds the point equidistant from four corner features", () => {
    const corners: GeoPoint[] = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 10, lon: 0 },
      { lat: 10, lon: 10 },
    ];
    const result = furthestPoint(regionFrom(box(0, 0, 10, 10)), corners, { gridKm: 20 });
    // On the sphere the circumcentre sits just south of 5° N: tan φ = cos 5° (1 − cos 10°) / sin 10°.
    const rad = Math.PI / 180;
    const lat =
      Math.atan((Math.cos(5 * rad) * (1 - Math.cos(10 * rad))) / Math.sin(10 * rad)) / rad;
    const expected = { lat, lon: 5 };
    expect(distanceKm(result.point, expected)).toBeLessThan(1);
    for (const c of corners) expect(distanceKm(result.point, c)).toBeCloseTo(result.distanceKm, 0);
    expect(result.nearest).toHaveLength(3);
  });

  it("finds the far edge's corner when features line one edge", () => {
    const edge = Array.from({ length: 101 }, (_, i) => ({ lat: i / 10, lon: 0 }));
    const result = furthestPoint(regionFrom(box(0, 0, 10, 10)), edge, { gridKm: 20 });
    // Distances along parallels shrink away from the equator, and the features are 0.1° apart: the
    // answer is on the far edge, midway between the first two features.
    const expected = { lat: 0.05, lon: 10 };
    const nearest = Math.min(
      distanceKm(expected, { lat: 0, lon: 0 }),
      distanceKm(expected, { lat: 0.1, lon: 0 }),
    );
    expect(result.distanceKm).toBeCloseTo(nearest, 2);
    expect(distanceKm(result.point, expected)).toBeLessThan(1);
  });

  it("counts features outside the region", () => {
    const outside = [
      { lat: 5, lon: -1 },
      { lat: 5, lon: 11 },
    ];
    const result = furthestPoint(regionFrom(box(0, 0, 10, 10)), outside, { gridKm: 20 });
    // Midway between the two, on the edge nearest the equator.
    expect(distanceKm(result.point, { lat: 0, lon: 5 })).toBeLessThan(2);
    expect(result.distanceKm).toBeCloseTo(distanceKm({ lat: 0, lon: 5 }, outside[0]!), 0);
  });

  it("works across the antimeridian", () => {
    const region = regionFrom(box(175, -5, 185, 5));
    expect(region.bbox[0]).toBeGreaterThan(region.bbox[2]);
    const result = furthestPoint(region, [{ lat: 0, lon: 170 }], { gridKm: 20 });
    // The far side of the box from a feature west of it: 185° = 175° W, at a corner.
    expect(Math.abs(result.point.lon + 175)).toBeLessThan(0.05);
    expect(Math.abs(result.point.lat)).toBeGreaterThan(4.9);
  });

  it("needs features", () => {
    expect(() => furthestPoint(regionFrom(box(0, 0, 1, 1)), [])).toThrow();
  });
});

describe("helpers", () => {
  it("tests points against rings", () => {
    const ring: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    expect(insideRings([ring], 5, 5)).toBe(true);
    expect(insideRings([ring], 15, 5)).toBe(false);
  });

  it("grows a box by a distance", () => {
    const [west, south, east, north] = expandBBox([0, 0, 10, 10], 111.195);
    expect(south).toBeCloseTo(-1, 6);
    expect(north).toBeCloseTo(11, 6);
    expect(west).toBeLessThan(-1);
    expect(east).toBeGreaterThan(11);
    const polar = expandBBox([-170, 80, 170, 89.5], 200);
    expect([polar[0], polar[2], polar[3]]).toEqual([-180, 180, 90]);
    expect(polar[1]).toBeCloseTo(78.2, 1);
  });
});
