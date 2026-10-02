import { COMPASS_POINTS } from "@/engines/map/geo";
import { DIRECTION_SPREAD, HINTS, PINS_PER_QUESTION, compassBearing, hintFor } from "./config";

describe("hints", () => {
  it("gives one hint per pin: which way first, then how far", () => {
    expect(HINTS).toHaveLength(PINS_PER_QUESTION);
    expect([0, 1, 2].map(hintFor)).toEqual(["direction", "distance", "distance"]);
  });

  it("draws a direction as its compass point's 45° wedge, never the exact bearing", () => {
    expect(DIRECTION_SPREAD).toBe(45);
    expect(COMPASS_POINTS.map(compassBearing)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });
});
