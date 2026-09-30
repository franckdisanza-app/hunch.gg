import { geoOrthographic, type GeoProjection } from "d3-geo";
import { globeRadius, type Camera } from "./camera";

// The orthographic projection for a camera. Kept apart from camera.ts so games can frame views
// (frameFor, flightPath) without pulling d3-geo's projection code into their first load: only the
// lazy-loaded Globe imports this.

/** An orthographic projection for the camera, clipped to the view. */
export function projectionFor(camera: Camera, width: number, height: number): GeoProjection {
  const { lat, lon } = camera.center;
  return geoOrthographic()
    .translate([width / 2, height / 2])
    .scale(globeRadius(width, height, camera.zoom))
    .rotate([-lon, -lat])
    .clipExtent([
      [-2, -2],
      [width + 2, height + 2],
    ]);
}
