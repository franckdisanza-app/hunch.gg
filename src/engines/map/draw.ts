import { geoDistance, geoGraticule10, geoInterpolate, geoPath, type GeoProjection } from "d3-geo";
import type { LineString } from "geojson";
import type { Atlas } from "./atlas";
import { easeOut, globeRadius, isVisible, type Camera } from "./camera";
import { capBox, clipPolygon } from "./clip";
import { circleIntersections, geodesicCircle, kmToDegrees, toLonLat, type GeoPoint } from "./geo";

// Draws the globe and everything on it onto a canvas. Plain functions: the Globe component owns
// the canvas, the camera and the frame loop; this file only paints one frame.

/** Colours of the globe. Values may be CSS colours or var(--name) references (resolved by Globe). */
export interface GlobeColors {
  ocean: string;
  land: string;
  coast: string;
  border: string;
  graticule: string;
  /** The outline of the sphere. */
  rim: string;
  /** Where two rings cross. */
  glow: string;
  /** The radar beam. */
  sweep: string;
  pin: string;
  pinInk: string;
  labelInk: string;
  labelBg: string;
}

export interface GlobeRing {
  id: string;
  center: GeoPoint;
  radiusKm: number;
  color: string;
  /** Drawn on the ring, e.g. "2,140 km · COLD". */
  label?: string;
  /** performance.now() when the ring started growing; unset: drawn at full size. */
  startedAt?: number;
}

export interface GlobePin {
  id: string;
  point: GeoPoint;
  /** Short text next to the pin, e.g. "1". */
  label?: string;
}

export interface GlobeBlip {
  id: string;
  point: GeoPoint;
  color: string;
  /** Filled when official, an open ring otherwise (so it never relies on colour alone). */
  official: boolean;
  label?: string;
}

export interface GlobeArc {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  color: string;
  /** performance.now() when the arc started drawing; unset: drawn in full. */
  startedAt?: number;
}

export interface GlobeScene {
  rings: readonly GlobeRing[];
  pins: readonly GlobePin[];
  blips: readonly GlobeBlip[];
  arcs?: readonly GlobeArc[];
  /** Glow where fully grown rings cross. */
  glowCrossings?: boolean;
  /**
   * A radar sweep over the blips: a new key starts one. Blips stay dark until the beam passes
   * them; blips out of sight light when it ends.
   */
  sweep?: { key: string };
}

export const RING_GROW_MS = 1100;
export const ARC_DRAW_MS = 1200;
export const SWEEP_MS = 1400;
const PULSE_MS = 2400;

export interface SweepState {
  key: string;
  startedAt: number;
}

export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  projection: GeoProjection;
  camera: Camera;
  atlas: Atlas | null;
  scene: GlobeScene;
  colors: GlobeColors;
  /** CSS font-family list for labels. */
  font: string;
  now: number;
  sweep: SweepState | null;
  /** Blip id → performance.now() when it lit up. */
  lit: ReadonlyMap<string, number>;
}

const graticule = geoGraticule10();
const sphere = { type: "Sphere" } as const;

/** 0…1 progress of an animation started at `startedAt`; 1 when it has no start. */
function progress(now: number, startedAt: number | undefined, durationMs: number): number {
  if (startedAt === undefined) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / durationMs));
}

/** The ring as a line (a polygon would be stroked along the horizon where it is clipped). */
function ringLine(center: GeoPoint, radiusKm: number): LineString {
  const degrees = kmToDegrees(radiusKm);
  const precision = Math.min(2, Math.max(0.05, degrees / 24));
  return {
    type: "LineString",
    coordinates: geodesicCircle(center, radiusKm, precision).coordinates[0]!,
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Label {
  text: string;
  color: string;
  /** Places the label may go, best first. */
  anchors: [number, number][];
}

type Rect = { left: number; top: number; w: number; h: number };

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;

/** A square around a marker that labels keep clear of. */
const around = ([x, y]: [number, number], r: number): Rect => ({
  left: x - r,
  top: y - r,
  w: 2 * r,
  h: 2 * r,
});

/**
 * Draws each label at its first anchor that overlaps neither a label already drawn nor a marker
 * (pins, blips, glows), or skips it.
 */
function placeLabels(input: FrameInput, labels: readonly Label[], obstacles: readonly Rect[]) {
  const { ctx, font, width, height } = input;
  ctx.font = `600 11px ${font}`;
  const placed: Rect[] = [...obstacles];
  for (const label of labels) {
    const w = ctx.measureText(label.text).width + 12;
    const h = 18;
    for (const [x, y] of label.anchors) {
      const rect = {
        left: Math.min(Math.max(4, x - w / 2), width - w - 4),
        top: Math.min(Math.max(4, y - h - 6), height - h - 4),
        w,
        h,
      };
      if (placed.some((other) => overlaps(rect, other))) continue;
      placed.push(rect);
      drawLabel(input, label.text, rect, label.color);
      break;
    }
  }
}

function drawLabel(input: FrameInput, text: string, rect: Rect, color: string) {
  const { ctx, colors } = input;
  const { left, top, w, h } = rect;
  roundedRect(ctx, left, top, w, h);
  ctx.fillStyle = colors.labelBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = colors.labelInk;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, left + 6, top + h / 2 + 0.5);
}

/** Where a ring's label may go: points of the ring in view and in front, highest first. */
function labelAnchors(input: FrameInput, line: LineString): [number, number][] {
  const anchors: [number, number][] = [];
  for (const coordinate of line.coordinates) {
    const point = { lon: coordinate[0]!, lat: coordinate[1]! };
    if (!isVisible(input.camera, point)) continue;
    const xy = input.projection(toLonLat(point));
    if (!xy) continue;
    const [x, y] = xy;
    if (x < 0 || x > input.width || y < 28 || y > input.height) continue;
    anchors.push([x, y]);
  }
  return anchors.sort((a, b) => a[1] - b[1]);
}

function project(input: FrameInput, point: GeoPoint): [number, number] | null {
  if (!isVisible(input.camera, point)) return null;
  return input.projection(toLonLat(point)) ?? null;
}

/** Paints one frame. Returns true while something is still moving (another frame is needed). */
export function drawFrame(input: FrameInput): boolean {
  const { ctx, width, height, dpr, projection, atlas, scene, colors, now } = input;
  let animating = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const path = geoPath(projection, ctx);

  // The sea, the radar grid, the land.
  ctx.beginPath();
  path(sphere);
  ctx.fillStyle = colors.ocean;
  ctx.fill();

  ctx.beginPath();
  path(graticule);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = colors.graticule;
  ctx.stroke();

  if (atlas) {
    // Only what can show: in front of the horizon and, zoomed in, inside the view. Zoomed in,
    // big polygons (continents) are first cut to the box around the view, so d3 projects only
    // their visible stretch.
    const { width: w, height: h, camera } = input;
    const reach = Math.hypot(w, h) / 2 / globeRadius(w, h, camera.zoom);
    const visible = (reach >= 1 ? Math.PI / 2 : Math.asin(reach)) + 0.02;
    const center = toLonLat(camera.center);
    const box = visible < 0.5 ? capBox(center, visible) : null;
    const inView = (part: { center: [number, number]; radius: number }) =>
      geoDistance(part.center, center) - part.radius < visible;
    ctx.beginPath();
    for (const part of atlas.parts) {
      if (!inView(part)) continue;
      if (box && part.points > 300) {
        const clipped = clipPolygon(part.geometry, box);
        if (clipped) path(clipped);
      } else {
        path(part.geometry);
      }
    }
    ctx.fillStyle = colors.land;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = colors.coast;
    ctx.stroke();

    ctx.beginPath();
    for (const part of atlas.borderParts) if (inView(part)) path(part.geometry);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = colors.border;
    ctx.stroke();
  }

  ctx.beginPath();
  path(sphere);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = colors.rim;
  ctx.stroke();

  // Rings grow from their pin to the target's distance, then freeze.
  const grown: { center: GeoPoint; radiusKm: number }[] = [];
  const labels: Label[] = [];
  const obstacles: Rect[] = [];
  for (const ring of scene.rings) {
    const t = progress(now, ring.startedAt, RING_GROW_MS);
    if (t < 1) animating = true;
    const radiusKm = Math.max(0.01, ring.radiusKm * easeOut(t));
    const line = ringLine(ring.center, radiusKm);
    ctx.beginPath();
    path(line);
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    ctx.strokeStyle = ring.color;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (t >= 1) {
      grown.push({ center: ring.center, radiusKm: ring.radiusKm });
      if (ring.label) {
        labels.push({ text: ring.label, color: ring.color, anchors: labelAnchors(input, line) });
      }
    }
  }

  // A faint glow where two rings cross: the answer is at one of those spots.
  if (scene.glowCrossings) {
    for (let i = 0; i < grown.length; i++) {
      for (let j = i + 1; j < grown.length; j++) {
        const a = grown[i]!;
        const b = grown[j]!;
        for (const point of circleIntersections(a.center, a.radiusKm, b.center, b.radiusKm)) {
          const xy = project(input, point);
          if (!xy) continue;
          obstacles.push(around(xy, 10));
          const glow = ctx.createRadialGradient(xy[0], xy[1], 0, xy[0], xy[1], 16);
          glow.addColorStop(0, colors.glow);
          glow.addColorStop(1, "transparent");
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = glow;
          ctx.fillRect(xy[0] - 16, xy[1] - 16, 32, 32);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Great-circle arcs, drawn from start to end.
  for (const arc of scene.arcs ?? []) {
    const t = progress(now, arc.startedAt, ARC_DRAW_MS);
    if (t < 1) animating = true;
    const along = geoInterpolate(toLonLat(arc.from), toLonLat(arc.to));
    const steps = 48;
    const coordinates = Array.from({ length: steps + 1 }, (_, i) =>
      along((i / steps) * easeOut(t)),
    );
    ctx.beginPath();
    path({ type: "LineString", coordinates });
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = arc.color;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Pins: a dot with a ring, numbered.
  for (const pin of scene.pins) {
    const xy = project(input, pin.point);
    if (!xy) continue;
    obstacles.push(around(xy, 9));
    const [x, y] = xy;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.pin;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.pinInk;
    ctx.stroke();
    if (pin.label) {
      ctx.font = `700 11px ${input.font}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = colors.labelBg;
      ctx.strokeText(pin.label, x + 9, y);
      ctx.fillStyle = colors.labelInk;
      ctx.fillText(pin.label, x + 9, y);
    }
  }

  // Target blips, once lit: filled when official, open rings for contenders, pulsing at first.
  for (const blip of scene.blips) {
    const litAt = input.lit.get(blip.id);
    if (litAt === undefined) continue;
    const xy = project(input, blip.point);
    if (!xy) continue;
    obstacles.push(around(xy, 12));
    const [x, y] = xy;
    const age = now - litAt;
    if (age < PULSE_MS) {
      animating = true;
      const phase = (age % 800) / 800;
      ctx.beginPath();
      ctx.arc(x, y, 7 + phase * 18, 0, Math.PI * 2);
      ctx.globalAlpha = (1 - phase) * 0.8;
      ctx.lineWidth = 2;
      ctx.strokeStyle = blip.color;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, blip.official ? 7 : 6, 0, Math.PI * 2);
    if (blip.official) {
      ctx.fillStyle = blip.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.labelBg;
      ctx.stroke();
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = blip.color;
      ctx.stroke();
    }
    if (blip.label) labels.unshift({ text: blip.label, color: blip.color, anchors: [[x, y - 6]] });
  }

  // The radar beam: a bright edge and a fading tail, clipped to the globe.
  if (input.sweep) {
    const t = progress(now, input.sweep.startedAt, SWEEP_MS);
    if (t < 1) {
      animating = true;
      const [cx, cy] = projection.translate();
      const r = projection.scale();
      const angle = -Math.PI / 2 + t * Math.PI * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const slices = 18;
      const tail = Math.PI / 3;
      for (let i = 0; i < slices; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle - ((i + 1) * tail) / slices, angle - (i * tail) / slices);
        ctx.closePath();
        ctx.globalAlpha = 0.28 * (1 - i / slices);
        ctx.fillStyle = colors.sweep;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.sweep;
      ctx.stroke();
      ctx.restore();
    }
  }

  placeLabels(input, labels, obstacles);
  return animating;
}

/**
 * The angle (canvas convention, clockwise from +x) at which the sweep beam sits at `now`, or null
 * when no sweep runs. Blips light when the beam passes their angle.
 */
export function sweepAngle(sweep: SweepState | null, now: number): number | null {
  if (!sweep) return null;
  const t = progress(now, sweep.startedAt, SWEEP_MS);
  return t >= 1 ? null : -Math.PI / 2 + t * Math.PI * 2;
}
