import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atlasFromTopology, countryAt, isLand } from "./atlas";

const topology: unknown = JSON.parse(
  readFileSync(join(process.cwd(), "node_modules", "world-atlas", "countries-110m.json"), "utf8"),
);
const atlas = atlasFromTopology("110m", topology);

describe("atlas", () => {
  it("builds land, borders and named countries", () => {
    expect(atlas.countries.length).toBeGreaterThan(150);
    expect(atlas.borders.coordinates.length).toBeGreaterThan(100);
  });

  it("finds the country under a point", () => {
    expect(countryAt(atlas, { lat: 46.8, lon: 8.2 })).toBe("Switzerland");
    expect(countryAt(atlas, { lat: -80, lon: 0 })).toBe("Antarctica");
    // Fiji straddles the antimeridian.
    expect(countryAt(atlas, { lat: -17.8, lon: 178 })).toBe("Fiji");
  });

  it("tells land from sea", () => {
    expect(countryAt(atlas, { lat: 0, lon: -160 })).toBeNull();
    expect(isLand(atlas, { lat: 0, lon: -160 })).toBe(false);
    expect(isLand(atlas, { lat: 46.8, lon: 8.2 })).toBe(true);
  });
});
