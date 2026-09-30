import type { Camera } from "./camera";
import { showsOnlyBackdrop, type GlobeScene } from "./draw";

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
      { ...empty, sweep: { key: "s" } },
    ];
    for (const scene of scenes) expect(showsOnlyBackdrop(world, scene, world)).toBe(false);
  });
});
