import {
  DEFAULT_LIMITS,
  clampCamera,
  degreesPerPixel,
  dragBy,
  flightPath,
  frameFor,
  isVisible,
  nudge,
  zoomBy,
} from "./camera";
import { projectionFor } from "./projection";
import { circleIntersections, distanceKm } from "./geo";

const W = 360;
const H = 360;

describe("camera", () => {
  it("clamps latitude, wraps longitude and limits zoom", () => {
    expect(clampCamera({ center: { lat: 95, lon: 190 }, zoom: 0.2 })).toEqual({
      center: { lat: 90, lon: -170 },
      zoom: DEFAULT_LIMITS.minZoom,
    });
    expect(zoomBy({ center: { lat: 0, lon: 0 }, zoom: 60 }, 4).zoom).toBe(DEFAULT_LIMITS.maxZoom);
  });

  it("drags like a globe under the finger", () => {
    const start = { center: { lat: 0, lon: 0 }, zoom: 1 };
    // Dragging right brings the west into view: the centre moves west.
    expect(dragBy(start, 50, 0, W, H).center.lon).toBeLessThan(0);
    // Dragging down brings the north into view.
    expect(dragBy(start, 0, 50, W, H).center.lat).toBeGreaterThan(0);
    // The point under the finger moves with it (at the centre of the view).
    const moved = dragBy(start, 10, 0, W, H);
    const [x] = projectionFor(moved, W, H)([0, 0])!;
    expect(x).toBeCloseTo(W / 2 + 10, 0);
    // Zoomed in, the same drag turns the globe less.
    expect(degreesPerPixel(W, H, 8)).toBeCloseTo(degreesPerPixel(W, H, 1) / 8, 9);
  });

  it("nudges by a share of the view", () => {
    const start = { center: { lat: 10, lon: 20 }, zoom: 2 };
    expect(nudge(start, "up").center.lat).toBeCloseTo(12.5, 9);
    expect(nudge(start, "down", true).center.lat).toBeCloseTo(0, 9);
    expect(nudge(start, "left").center.lon).toBeLessThan(20);
    expect(nudge(start, "right").center.lon).toBeGreaterThan(20);
  });

  it("knows which side of the globe faces the viewer", () => {
    const view = { center: { lat: 0, lon: 0 }, zoom: 1 };
    expect(isVisible(view, { lat: 10, lon: 80 })).toBe(true);
    expect(isVisible(view, { lat: 0, lon: 120 })).toBe(false);
  });
});

describe("frameFor", () => {
  it("frames nearby points closely and far-flung ones with the whole globe", () => {
    const near = frameFor([
      { lat: 46, lon: 7 },
      { lat: 47, lon: 9 },
    ]);
    expect(near.zoom).toBeGreaterThan(4);
    expect(near.center.lat).toBeCloseTo(46.5, 0);
    const far = frameFor([
      { lat: 50, lon: 0 },
      { lat: -40, lon: 170 },
    ]);
    expect(far.zoom).toBe(1);
    // They cannot all be in view: the first point (the one that matters) is.
    expect(far.center).toEqual({ lat: 50, lon: 0 });
  });

  it("keeps every point in view", () => {
    const points = [
      { lat: 10, lon: 170 },
      { lat: -5, lon: -175 },
      { lat: 20, lon: -160 },
    ];
    const view = frameFor(points);
    for (const point of points) expect(isVisible(view, point)).toBe(true);
  });
});

describe("flightPath", () => {
  it("starts and ends where asked, and pulls back on long flights", () => {
    const from = { center: { lat: 47, lon: 8 }, zoom: 6 };
    const to = { center: { lat: -34, lon: 151 }, zoom: 6 };
    const path = flightPath(from, to);
    expect(path.at(0).center.lat).toBeCloseTo(47, 6);
    expect(path.at(1).center.lon).toBeCloseTo(151, 6);
    expect(path.at(1).zoom).toBeCloseTo(6, 6);
    expect(path.at(0.5).zoom).toBeLessThan(2);
    expect(path.durationMs).toBeGreaterThan(flightPath(from, from).durationMs);
  });
});

describe("circleIntersections", () => {
  it("finds the two points at both distances", () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 20 };
    const points = circleIntersections(a, 1500, b, 1500);
    expect(points).toHaveLength(2);
    for (const p of points) {
      expect(distanceKm(p, a)).toBeCloseTo(1500, 3);
      expect(distanceKm(p, b)).toBeCloseTo(1500, 3);
      expect(p.lon).toBeCloseTo(10, 6);
    }
    expect(points[0]!.lat).toBeCloseTo(-points[1]!.lat, 6);
  });

  it("works across the antimeridian and finds nothing when circles miss", () => {
    const a = { lat: -15, lon: 178 };
    const b = { lat: -12, lon: -175 };
    for (const p of circleIntersections(a, 600, b, 700)) {
      expect(distanceKm(p, a)).toBeCloseTo(600, 3);
      expect(distanceKm(p, b)).toBeCloseTo(700, 3);
    }
    expect(circleIntersections({ lat: 0, lon: 0 }, 100, { lat: 0, lon: 40 }, 100)).toEqual([]);
    expect(circleIntersections({ lat: 0, lon: 0 }, 100, { lat: 0, lon: 0 }, 200)).toEqual([]);
  });
});
