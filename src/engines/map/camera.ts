import { geoCentroid, geoDistance, geoInterpolate } from "d3-geo";
import { clampLat, fromLonLat, normalizeLon, toLonLat, type GeoPoint } from "./geo";

// The globe's camera, as pure functions: where the crosshair points (the centre of the view) and
// how far in the view is zoomed. North always stays up, so players keep their bearings. The
// projection itself lives in projection.ts, which only the (lazy-loaded) Globe needs.

export interface Camera {
  /** The point under the crosshair. */
  center: GeoPoint;
  /** 1 fits the whole globe in the view; 2 doubles its size, and so on. */
  zoom: number;
}

export interface CameraLimits {
  minZoom: number;
  maxZoom: number;
}

export const DEFAULT_LIMITS: CameraLimits = { minZoom: 1, maxZoom: 64 };

/** The globe's radius at zoom 1 is this share of half the shorter side of the view. */
const FIT = 0.92;

export function clampCamera(camera: Camera, limits: CameraLimits = DEFAULT_LIMITS): Camera {
  return {
    center: { lat: clampLat(camera.center.lat), lon: normalizeLon(camera.center.lon) },
    zoom: Math.min(limits.maxZoom, Math.max(limits.minZoom, camera.zoom)),
  };
}

/** The globe's radius in CSS pixels. */
export function globeRadius(width: number, height: number, zoom: number): number {
  return (Math.min(width, height) / 2) * FIT * zoom;
}

/** Degrees of arc per CSS pixel at the centre of the view. */
export function degreesPerPixel(width: number, height: number, zoom: number): number {
  return 180 / Math.PI / globeRadius(width, height, zoom);
}

/**
 * Moves the camera as if the globe were dragged by (dx, dy) pixels: the point under the finger
 * stays (roughly) under it. Longitude steps grow towards the poles, up to a limit.
 */
export function dragBy(
  camera: Camera,
  dx: number,
  dy: number,
  width: number,
  height: number,
  limits?: CameraLimits,
): Camera {
  const k = degreesPerPixel(width, height, camera.zoom);
  const cos = Math.max(0.25, Math.cos((camera.center.lat * Math.PI) / 180));
  return clampCamera(
    {
      center: { lat: camera.center.lat + dy * k, lon: camera.center.lon - (dx * k) / cos },
      zoom: camera.zoom,
    },
    limits,
  );
}

export function zoomBy(camera: Camera, factor: number, limits?: CameraLimits): Camera {
  return clampCamera({ ...camera, zoom: camera.zoom * factor }, limits);
}

/** One arrow-key step: a fixed share of the view, so it is finer when zoomed in. */
export function nudge(
  camera: Camera,
  direction: "left" | "right" | "up" | "down",
  big = false,
  limits?: CameraLimits,
): Camera {
  const step = (big ? 20 : 5) / camera.zoom;
  const cos = Math.max(0.25, Math.cos((camera.center.lat * Math.PI) / 180));
  const { lat, lon } = camera.center;
  const center =
    direction === "left"
      ? { lat, lon: lon - step / cos }
      : direction === "right"
        ? { lat, lon: lon + step / cos }
        : direction === "up"
          ? { lat: lat + step, lon }
          : { lat: lat - step, lon };
  return clampCamera({ center, zoom: camera.zoom }, limits);
}

/** Whether a point is on the side of the globe facing the viewer. */
export function isVisible(camera: Camera, point: GeoPoint): boolean {
  return geoDistance(toLonLat(camera.center), toLonLat(point)) < Math.PI / 2 - 1e-6;
}

/**
 * A view that shows every point: centred on their spherical centroid, zoomed so the farthest one
 * sits inside the globe's visible disc with some margin. The first point matters most: when the
 * points cannot all be in view (spread over more than a hemisphere), the view centres on it at
 * zoom 1.
 */
export function frameFor(points: readonly GeoPoint[], limits?: CameraLimits): Camera {
  if (points.length === 0) return { center: { lat: 20, lon: 0 }, zoom: 1 };
  const first = points[0]!;
  if (points.length === 1) return clampCamera({ center: first, zoom: 4 }, limits);
  const coordinates = points.map(toLonLat);
  const center = fromLonLat(geoCentroid({ type: "MultiPoint", coordinates }) as [number, number]);
  // The centroid of points spread around the globe is ill-defined.
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) {
    return clampCamera({ center: first, zoom: 1 }, limits);
  }
  const farthest = Math.max(...coordinates.map((c) => geoDistance(toLonLat(center), c)));
  if (farthest >= (Math.PI / 2) * 0.85) return clampCamera({ center: first, zoom: 1 }, limits);
  // On an orthographic globe a point at angle θ from the centre sits sin(θ) radii out.
  const zoom = 0.8 / Math.max(Math.sin(farthest), 1e-3);
  return clampCamera({ center, zoom: Math.min(zoom, 8) }, limits);
}

/** Ease in and out (cubic). */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * A fly-to path: the centre follows the great circle, the zoom eases out and back in (so long
 * flights pull back to show where they go). Returns the camera at t in [0, 1] and a duration in ms
 * that grows with the distance.
 */
export function flightPath(
  from: Camera,
  to: Camera,
): { at(t: number): Camera; durationMs: number } {
  const a = toLonLat(from.center);
  const b = toLonLat(to.center);
  const angle = geoDistance(a, b);
  const move = geoInterpolate(a, b);
  // Zoom out on the way for long flights: down to 1 for a flight across the globe.
  const cruise = Math.min(from.zoom, to.zoom, Math.max(1, 1 / Math.max(angle, 1e-3)));
  const logFrom = Math.log(from.zoom);
  const logTo = Math.log(to.zoom);
  const logCruise = Math.log(cruise);
  const durationMs = Math.round(
    500 + 700 * Math.min(1, angle / Math.PI) + 150 * Math.abs(logTo - logFrom),
  );
  return {
    durationMs,
    at(t: number): Camera {
      const e = easeInOut(Math.min(1, Math.max(0, t)));
      // Straight log-zoom blend, dipped towards the cruise zoom in the middle.
      const straight = logFrom + (logTo - logFrom) * e;
      const dip = Math.min(0, logCruise - Math.min(logFrom, logTo)) * Math.sin(Math.PI * e);
      return {
        center: fromLonLat(move(e) as [number, number]),
        zoom: Math.exp(straight + dip),
      };
    },
  };
}
