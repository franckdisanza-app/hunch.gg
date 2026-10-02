import {
  geoArea,
  geoDistance,
  geoGraticule10,
  geoInterpolate,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import type { LineString, Polygon } from "geojson";
import type { Atlas } from "./atlas";
import { easeOut, globeRadius, isVisible, type Camera } from "./camera";
import { capBox, clipPolygon } from "./clip";
import {
  EARTH_RADIUS_KM,
  circleIntersections,
  geodesicCircle,
  kmToDegrees,
  normalizeLon,
  rhumbLine,
  toLonLat,
  type GeoPoint,
} from "./geo";

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

/**
 * A direction hint: a wedge fanning out from a point across `spread` degrees of map directions
 * (rhumb lines, see geo.ts) as far as they go (a pole, or half the world east or west), fading with
 * distance, with an arrow down its middle.
 */
export interface GlobeDirection {
  id: string;
  from: GeoPoint;
  /** The wedge's middle: compass degrees, clockwise from north. */
  bearing: number;
  /** The wedge's width in degrees, e.g. 45 for one of 8 compass points. */
  spread: number;
  /** Defaults to the sweep colour. */
  color?: string;
  /** Drawn past the arrow's tip, e.g. "NE". */
  label?: string;
  /** performance.now() when the wedge started opening; unset: drawn open. */
  startedAt?: number;
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
  directions?: readonly GlobeDirection[];
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

/** Margins (CSS px) along the edges of the view where labels never go, e.g. under overlays. */
export interface LabelInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_LABEL_INSETS: LabelInsets = { top: 28, right: 4, bottom: 4, left: 4 };

export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  /** Where labels keep clear of the edges (default DEFAULT_LABEL_INSETS). */
  labelInsets?: LabelInsets;
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

/**
 * Whether a frame would show only what a backdrop picture of `backdrop` already shows: the same
 * view, and nothing on the globe (no rings, pins, blips, arcs or sweep).
 */
export function showsOnlyBackdrop(
  view: Camera,
  scene: GlobeScene,
  backdrop: Camera | undefined,
): boolean {
  if (!backdrop) return false;
  const empty =
    scene.rings.length === 0 &&
    scene.pins.length === 0 &&
    scene.blips.length === 0 &&
    !scene.arcs?.length &&
    !scene.directions?.length &&
    !scene.sweep;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  return (
    empty &&
    near(view.zoom, backdrop.zoom) &&
    near(view.center.lat, backdrop.center.lat) &&
    near(normalizeLon(view.center.lon - backdrop.center.lon), 0)
  );
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
  const insets = input.labelInsets ?? DEFAULT_LABEL_INSETS;
  ctx.font = `600 11px ${font}`;
  const placed: Rect[] = [...obstacles];
  for (const label of labels) {
    const w = ctx.measureText(label.text).width + 12;
    const h = 18;
    for (const [x, y] of label.anchors) {
      const rect = {
        left: Math.min(Math.max(insets.left, x - w / 2), width - w - insets.right),
        top: Math.min(Math.max(insets.top, y - h - 6), height - h - insets.bottom),
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
  const insets = input.labelInsets ?? DEFAULT_LABEL_INSETS;
  const anchors: [number, number][] = [];
  for (const coordinate of line.coordinates) {
    const point = { lon: coordinate[0]!, lat: coordinate[1]! };
    if (!isVisible(input.camera, point)) continue;
    const xy = input.projection(toLonLat(point));
    if (!xy) continue;
    const [x, y] = xy;
    if (x < 0 || x > input.width || y < insets.top || y > input.height - insets.bottom) continue;
    anchors.push([x, y]);
  }
  return anchors.sort((a, b) => a[1] - b[1]);
}

function project(input: FrameInput, point: GeoPoint): [number, number] | null {
  if (!isVisible(input.camera, point)) return null;
  return input.projection(toLonLat(point)) ?? null;
}

/** Rhumb lines across a wedge, and the step along them. */
const WEDGE_LINES = 12;
const WEDGE_STEP_KM = 250;
/** Far enough for any rhumb line to reach a pole or half the world. */
const WEDGE_REACH_KM = 4 * Math.PI * EARTH_RADIUS_KM;
/** The arrow down a wedge's middle, CSS px. */
const ARROW_PX = 58;

/**
 * A direction's wedge as a polygon: out along its first edge, across the ends of the rhumb lines
 * in between, and back along the other edge. Never more than a hemisphere, so d3 fills the inside.
 */
export function wedgePolygon(
  direction: Pick<GlobeDirection, "from" | "bearing" | "spread">,
): Polygon {
  const { from, bearing, spread } = direction;
  const lines = Array.from({ length: WEDGE_LINES + 1 }, (_, k) =>
    rhumbLine(
      from,
      bearing - spread / 2 + (spread * k) / WEDGE_LINES,
      WEDGE_REACH_KM,
      WEDGE_STEP_KM,
    ),
  );
  const ring = [
    ...lines[0]!,
    ...lines.slice(1, -1).map((line) => line.at(-1)!),
    ...[...lines.at(-1)!].reverse(),
  ].map(toLonLat);
  const polygon: Polygon = { type: "Polygon", coordinates: [ring] };
  // d3 fills the smaller side of a ring wound clockwise; the other winding means the rest.
  return geoArea(polygon) > 2 * Math.PI
    ? { type: "Polygon", coordinates: [[...ring].reverse()] }
    : polygon;
}

/** Wedges only change with their hint: computed once, by id. */
const wedges = new Map<string, { key: string; polygon: Polygon }>();

function wedgeFor(direction: GlobeDirection): Polygon {
  const key = `${direction.from.lat},${direction.from.lon},${direction.bearing},${direction.spread}`;
  const cached = wedges.get(direction.id);
  if (cached?.key === key) return cached.polygon;
  const polygon = wedgePolygon(direction);
  wedges.set(direction.id, { key, polygon });
  return polygon;
}

/**
 * Paints a direction hint: the wedge, fading with distance from its point and opening out from it
 * over RING_GROW_MS, then the arrow and its label. Returns true while it opens.
 */
function drawDirection(
  input: FrameInput,
  path: ReturnType<typeof geoPath>,
  direction: GlobeDirection,
  labels: Label[],
): boolean {
  const { ctx, projection, colors, now } = input;
  const color = direction.color ?? colors.sweep;
  const t = progress(now, direction.startedAt, RING_GROW_MS);
  const origin = project(input, direction.from);
  const globe = projection.scale();
  const [cx, cy] = origin ?? projection.translate();
  // How far out it fades: most of the globe, never much past the view when zoomed in.
  const reach = Math.min(globe * 1.8, Math.hypot(input.width, input.height) * 0.9);

  ctx.save();
  if (t < 1) {
    // Opening: only what a circle growing from the point has reached so far.
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, easeOut(t) * reach * 1.2), 0, Math.PI * 2);
    ctx.clip();
  }
  const fade = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  fade.addColorStop(0, color);
  fade.addColorStop(0.45, color);
  fade.addColorStop(1, "transparent");
  ctx.beginPath();
  path(wedgeFor(direction));
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = fade;
  ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = fade;
  ctx.stroke();
  ctx.restore();

  // The arrow: a short stretch of the middle rhumb line, from the point.
  if (origin && t >= 1) {
    const km = (ARROW_PX * EARTH_RADIUS_KM) / globe;
    const shaft = rhumbLine(direction.from, direction.bearing, km, km / 8)
      .map((point) => project(input, point))
      .filter((xy): xy is [number, number] => xy !== null);
    const tip = shaft.at(-1);
    const back = shaft.at(-2);
    if (tip && back && shaft.length > 2) {
      ctx.beginPath();
      shaft.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.stroke();
      const angle = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
      ctx.beginPath();
      ctx.moveTo(tip[0] + Math.cos(angle) * 6, tip[1] + Math.sin(angle) * 6);
      ctx.lineTo(tip[0] + Math.cos(angle + 2.4) * 9, tip[1] + Math.sin(angle + 2.4) * 9);
      ctx.lineTo(tip[0] + Math.cos(angle - 2.4) * 9, tip[1] + Math.sin(angle - 2.4) * 9);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (direction.label) {
        // Centred past the tip (placeLabels puts a label's box above its anchor).
        const x = tip[0] + Math.cos(angle) * 26;
        const y = tip[1] + Math.sin(angle) * 26 + 15;
        labels.unshift({ text: direction.label, color, anchors: [[x, y]] });
      }
    }
  }
  return t < 1;
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

  const labels: Label[] = [];
  const obstacles: Rect[] = [];

  // Direction hints, under the rings.
  for (const direction of scene.directions ?? []) {
    if (drawDirection(input, path, direction, labels)) animating = true;
  }

  // Rings grow from their pin to the target's distance, then freeze.
  const grown: { center: GeoPoint; radiusKm: number }[] = [];
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
