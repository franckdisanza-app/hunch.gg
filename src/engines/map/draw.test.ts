import { geoArea, geoContains } from "d3-geo";
import type { Camera } from "./camera";
import { showsOnlyBackdrop, wedgePolygon, type GlobeScene } from "./draw";
import { rhumbDestination, toLonLat, type GeoPoint } from "./geo";

const world: Camera = { center: { lat: 20, lon: 10 }, zoom: 1 };
const empty: GlobeScene = { rings: [], pins: [], blips: [] };

describe("showsOnlyBackdrop", () => {
  it("is true on the backdrop's view with nothing on the globe", () => {
    expect(showsOnlyBackdrop(world, empty, world)).toBe(true);
    // The same longitude written another way round the world.
    expect(showsOnlyBackdrop({ ...world, center: { lat: 20, lon: 370 } }, empty, world)).toBe(true);
  });

  it("is false without a backdrop, or once the view moves", () => {
    expect(showsOnlyBackdrop(world, empty, undefined)).toBe(false);
    expect(showsOnlyBackdrop({ ...world, zoom: 1.5 }, empty, world)).toBe(false);
    expect(showsOnlyBackdrop({ ...world, center: { lat: 20.5, lon: 10 } }, empty, world)).toBe(
      false,
    );
    expect(showsOnlyBackdrop({ ...world, center: { lat: 20, lon: 11 } }, empty, world)).toBe(false);
  });

  it("is false as soon as anything is on the globe", () => {
    const point = { lat: 0, lon: 0 };
    const scenes: GlobeScene[] = [
      { ...empty, pins: [{ id: "p", point }] },
      { ...empty, rings: [{ id: "r", center: point, radiusKm: 100, color: "#000" }] },
      { ...empty, blips: [{ id: "b", point, color: "#000", official: true }] },
      { ...empty, arcs: [{ id: "a", from: point, to: point, color: "#000" }] },
      { ...empty, directions: [{ id: "d", from: point, bearing: 45, spread: 45 }] },
      { ...empty, sweep: { key: "s" } },
    ];
    for (const scene of scenes) expect(showsOnlyBackdrop(world, scene, world)).toBe(false);
  });
});

describe("wedgePolygon", () => {
  const along = (from: GeoPoint, bearing: number, km: number) =>
    toLonLat(rhumbDestination(from, bearing, km)!);

  it("covers the map directions it names, and only those", () => {
    const from = { lat: 10, lon: 20 };
    const wedge = wedgePolygon({ from, bearing: 45, spread: 45 });
    expect(geoArea(wedge)).toBeLessThan(2 * Math.PI);
    expect(geoContains(wedge, along(from, 45, 3000))).toBe(true);
    expect(geoContains(wedge, along(from, 25, 800))).toBe(true);
    expect(geoContains(wedge, along(from, 65, 6000))).toBe(true);
    expect(geoContains(wedge, along(from, 80, 1000))).toBe(false);
    expect(geoContains(wedge, along(from, 10, 1000))).toBe(false);
    expect(geoContains(wedge, along(from, 225, 1000))).toBe(false);
  });

  it("reaches far: up to a pole, and across the antimeridian the short way", () => {
    const north = wedgePolygon({ from: { lat: -20, lon: 0 }, bearing: 0, spread: 45 });
    expect(geoContains(north, [0, 80])).toBe(true);
    expect(geoContains(north, [0, -40])).toBe(false);
    // From Fiji, east crosses the antimeridian.
    const east = wedgePolygon({ from: { lat: -18, lon: 178 }, bearing: 90, spread: 45 });
    expect(geoContains(east, [-170, -18])).toBe(true);
    expect(geoContains(east, [170, -18])).toBe(false);
  });
});
