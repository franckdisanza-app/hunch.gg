"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "@/frame/ui/cx";
import { countryAt, loadAtlas, type Atlas } from "./atlas";
import {
  DEFAULT_LIMITS,
  clampCamera,
  dragBy,
  flightPath,
  nudge,
  projectionFor,
  zoomBy,
  type Camera,
  type CameraLimits,
} from "./camera";
import { drawFrame, sweepAngle, type GlobeColors, type GlobeScene, type SweepState } from "./draw";
import { normalizeLon, type GeoPoint } from "./geo";

// The globe: an orthographic d3-geo globe on a canvas at the device pixel ratio, turned by
// dragging (with inertia), zoomed by pinching, the wheel or +/−, and aimed with a fixed crosshair
// in the middle. Keyboard: arrows turn it (Shift for bigger steps), +/− zoom, Enter drops a pin.
// Screen readers hear the coordinates and country under the crosshair when it settles. Under
// reduced motion there is no inertia, fly-to or sweep: every change is a jump cut.

export interface GlobeHandle {
  /** The point under the crosshair. */
  center(): GeoPoint;
  /** Stops any glide and returns the point under the crosshair: what dropping a pin uses. */
  aim(): GeoPoint;
  view(): Camera;
  /** Flies to a view (a jump cut under reduced motion); resolves when it arrives. */
  flyTo(view: Camera): Promise<void>;
  /** Jumps to a view at once. */
  setView(view: Camera): void;
  /** Moves keyboard focus to the globe. */
  focus(): void;
}

export interface AimDescription {
  point: GeoPoint;
  /** The country under the crosshair, null over the sea. */
  country: string | null;
  zoom: number;
}

export interface GlobeProps {
  scene: GlobeScene;
  /** CSS colours or var(--name) references, resolved on the globe's element (follows the theme). */
  colors: GlobeColors;
  /** Font family list for labels on the canvas, or a var(--name) reference to one. */
  font: string;
  initialView?: Camera;
  limits?: Partial<CameraLimits>;
  /** False while the game animates the globe itself (e.g. during a reveal). */
  interactive?: boolean;
  reducedMotion: boolean;
  /** Accessible name, e.g. "Globe". */
  label: string;
  /** How to use it, read after the name: "Drag to turn, pinch to zoom…". */
  instructions: string;
  /** What screen readers hear when the crosshair settles. */
  describeAim?: (aim: AimDescription) => string;
  /** Text of a live readout under the crosshair (updated every frame, without re-rendering). */
  readout?: (center: GeoPoint, zoom: number) => string;
  readoutClassName?: string;
  /** Enter on the focused globe. */
  onDrop?: () => void;
  /** A sweep (scene.sweep) ended and every blip is lit. */
  onSweepEnd?: (key: string) => void;
  /** Drawn at the centre, over the canvas. */
  crosshair?: ReactNode;
  className?: string;
  /** Overlays, positioned by the game. */
  children?: ReactNode;
  ref?: Ref<GlobeHandle>;
}

/** Zoom above which the 1:50m shapes are used (loaded the first time it is reached). */
const DETAIL_ZOOM = 2.5;
/** Inertia: the glide slows with this time constant (ms), and stops below this speed (deg/ms). */
const INERTIA_TAU_MS = 325;
const INERTIA_STOP = 0.0008;
/** Fastest glide at zoom 1, deg/ms (slower when zoomed in). */
const INERTIA_MAX = 0.12;
const SETTLE_MS = 450;
const MAX_DPR = 2;

type Velocity = { lon: number; lat: number };
type Sample = { t: number; lon: number; lat: number };

function resolveVar(value: string, style: CSSStyleDeclaration | null): string {
  const match = /^var\((--[\w-]+)\)$/.exec(value.trim());
  if (!match || !style) return value;
  return style.getPropertyValue(match[1]!).trim() || value;
}

function DefaultCrosshair() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M22 2v10M22 32v10M2 22h10M32 22h10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Globe({
  scene,
  colors,
  font,
  initialView,
  limits: limitOverrides,
  interactive = true,
  reducedMotion,
  label,
  instructions,
  describeAim,
  readout,
  readoutClassName,
  onDrop,
  onSweepEnd,
  crosshair,
  className,
  children,
  ref,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const instructionsId = useId();
  const [announcement, setAnnouncement] = useState("");

  const limits: CameraLimits = { ...DEFAULT_LIMITS, ...limitOverrides };
  const camera = useRef<Camera>(
    clampCamera(initialView ?? { center: { lat: 20, lon: 10 }, zoom: 1 }, limits),
  );
  const size = useRef({ width: 0, height: 0, dpr: 1 });
  const atlases = useRef<Partial<Record<Atlas["detail"], Atlas>>>({});
  const detailRequested = useRef(false);
  const resolved = useRef<{ colors: GlobeColors; font: string } | null>(null);
  const sweep = useRef<SweepState | null>(null);
  const sweepKey = useRef<string | undefined>(undefined);
  const lit = useRef(new Map<string, number>());
  const inertia = useRef<(Velocity & { last: number }) | null>(null);
  const flight = useRef<{
    path: ReturnType<typeof flightPath>;
    target: Camera;
    startedAt: number;
    resolve: () => void;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const samples = useRef<Sample[]>([]);
  const raf = useRef(0);
  const settleTimer = useRef<number | undefined>(undefined);
  // The camera of the last frame drawn: any change since (drag, keys, wheel, flights) settles.
  const drawnCamera = useRef<Camera | null>(null);

  // Latest props for the frame loop and event handlers.
  const props = useRef({ scene, colors, font, interactive, reducedMotion, limits, describeAim });
  const callbacks = useRef({ readout, onDrop, onSweepEnd });
  useLayoutEffect(() => {
    props.current = { scene, colors, font, interactive, reducedMotion, limits, describeAim };
    callbacks.current = { readout, onDrop, onSweepEnd };
  });

  const frameRef = useRef<(now: number) => void>(() => {});
  const requestFrame = useCallback(() => {
    if (raf.current || typeof window === "undefined") return;
    raf.current = window.requestAnimationFrame((now) => frameRef.current(now));
  }, []);

  const resolveStyle = useCallback(() => {
    const el = containerRef.current;
    const style = el ? getComputedStyle(el) : null;
    const { colors: raw, font: rawFont } = props.current;
    const entries = Object.entries(raw).map(([k, v]) => [k, resolveVar(v, style)]);
    resolved.current = {
      colors: Object.fromEntries(entries) as unknown as GlobeColors,
      font: `${resolveVar(rawFont, style)}, ui-monospace, monospace`,
    };
  }, []);

  const bestAtlas = useCallback((): Atlas | null => {
    const detailed = atlases.current["50m"];
    if (detailed && camera.current.zoom >= DETAIL_ZOOM - 0.3) return detailed;
    return atlases.current["110m"] ?? null;
  }, []);

  const settle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const { describeAim: describe, interactive: canAim } = props.current;
      if (!describe || !canAim || flight.current) return;
      const atlas = bestAtlas();
      const point = camera.current.center;
      setAnnouncement(
        describe({
          point,
          country: atlas ? countryAt(atlas, point) : null,
          zoom: camera.current.zoom,
        }),
      );
    }, SETTLE_MS);
  }, [bestAtlas]);

  const frame = useCallback(
    (now: number) => {
      raf.current = 0;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const { width, height, dpr } = size.current;
      if (!canvas || !ctx || width === 0 || height === 0) return;
      if (!resolved.current) resolveStyle();
      const { scene: currentScene, limits: currentLimits } = props.current;
      let moving = false;

      const trip = flight.current;
      if (trip) {
        const t = (now - trip.startedAt) / trip.path.durationMs;
        if (t >= 1) {
          camera.current = trip.target;
          flight.current = null;
          trip.resolve();
        } else {
          camera.current = clampCamera(trip.path.at(t), currentLimits);
          moving = true;
        }
      } else if (inertia.current) {
        const glide = inertia.current;
        const dt = Math.min(64, now - glide.last);
        glide.last = now;
        const decay = Math.exp(-dt / INERTIA_TAU_MS);
        glide.lon *= decay;
        glide.lat *= decay;
        camera.current = clampCamera(
          {
            center: {
              lat: camera.current.center.lat + glide.lat * dt,
              lon: camera.current.center.lon + glide.lon * dt,
            },
            zoom: camera.current.zoom,
          },
          currentLimits,
        );
        if (Math.hypot(glide.lon, glide.lat) < INERTIA_STOP) inertia.current = null;
        else moving = true;
      }

      const moved = drawnCamera.current !== camera.current;
      drawnCamera.current = camera.current;
      const projection = projectionFor(camera.current, width, height);

      // The sweep lights blips as the beam passes them, and every blip when it ends.
      const running = sweep.current;
      if (running) {
        const angle = sweepAngle(running, now);
        const [cx, cy] = projection.translate();
        for (const blip of currentScene.blips) {
          if (lit.current.has(blip.id)) continue;
          if (angle === null) {
            lit.current.set(blip.id, now);
            continue;
          }
          const xy = projection([normalizeLon(blip.point.lon), blip.point.lat]);
          if (!xy) continue;
          let theta = Math.atan2(xy[1] - cy, xy[0] - cx);
          if (theta < -Math.PI / 2) theta += Math.PI * 2;
          if (theta <= angle) lit.current.set(blip.id, now);
        }
        if (angle === null) {
          sweep.current = null;
          callbacks.current.onSweepEnd?.(running.key);
        }
      }

      const animating = drawFrame({
        ctx,
        width,
        height,
        dpr,
        projection,
        camera: camera.current,
        atlas: bestAtlas(),
        scene: currentScene,
        colors: resolved.current!.colors,
        font: resolved.current!.font,
        now,
        sweep: sweep.current,
        lit: lit.current,
      });

      if (readoutRef.current && callbacks.current.readout) {
        readoutRef.current.textContent = callbacks.current.readout(
          camera.current.center,
          camera.current.zoom,
        );
      }
      if (moved) {
        settle();
        if (camera.current.zoom >= DETAIL_ZOOM && !detailRequested.current) {
          detailRequested.current = true;
          loadAtlas("50m")
            .then((atlas) => {
              atlases.current["50m"] = atlas;
              requestFrame();
            })
            .catch(() => {
              detailRequested.current = false;
            });
        }
      }
      if (moving || animating || sweep.current) requestFrame();
    },
    [bestAtlas, resolveStyle, settle, requestFrame],
  );

  useLayoutEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  // Size the canvas to its box at the device pixel ratio.
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const resize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const width = el.clientWidth;
      const height = el.clientHeight;
      size.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      requestFrame();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [requestFrame]);

  // The land: 1:110m straight away.
  useEffect(() => {
    let cancelled = false;
    loadAtlas("110m")
      .then((atlas) => {
        if (cancelled) return;
        atlases.current["110m"] = atlas;
        requestFrame();
        settle();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [requestFrame, settle]);

  // Colours follow the theme; labels follow the web font once it loads.
  useEffect(() => {
    const restyle = () => {
      resolveStyle();
      requestFrame();
    };
    restyle();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", restyle);
    const observer = new MutationObserver(restyle);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    document.fonts?.addEventListener("loadingdone", restyle);
    return () => {
      media.removeEventListener("change", restyle);
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", restyle);
    };
  }, [colors, font, resolveStyle, requestFrame]);

  // A new scene: start a sweep when its key is new; blips outside a sweep are lit at once.
  useEffect(() => {
    const key = scene.sweep?.key;
    if (key && key !== sweepKey.current) {
      sweep.current = reducedMotion ? null : { key, startedAt: performance.now() };
      if (!reducedMotion) lit.current.clear();
    }
    sweepKey.current = key;
    const ids = new Set(scene.blips.map((b) => b.id));
    for (const id of lit.current.keys()) if (!ids.has(id)) lit.current.delete(id);
    if (!sweep.current) {
      for (const blip of scene.blips)
        if (!lit.current.has(blip.id)) lit.current.set(blip.id, -Infinity);
      if (key && reducedMotion) callbacks.current.onSweepEnd?.(key);
    }
    requestFrame();
  }, [scene, reducedMotion, requestFrame]);

  useEffect(
    () => () => {
      // Reset the id too: a remount (Strict Mode, fast refresh) must be able to request frames.
      if (raf.current) window.cancelAnimationFrame(raf.current);
      raf.current = 0;
      window.clearTimeout(settleTimer.current);
      flight.current?.resolve();
      flight.current = null;
    },
    [],
  );

  /** Stops a glide or a flight where it is (a flight's promise resolves). */
  const stopMotion = useCallback(() => {
    inertia.current = null;
    const trip = flight.current;
    flight.current = null;
    trip?.resolve();
  }, []);

  const moveTo = useCallback(
    (next: Camera) => {
      camera.current = clampCamera(next, props.current.limits);
      requestFrame();
    },
    [requestFrame],
  );

  useImperativeHandle(
    ref,
    (): GlobeHandle => ({
      center: () => camera.current.center,
      aim() {
        stopMotion();
        return camera.current.center;
      },
      view: () => camera.current,
      setView(view) {
        stopMotion();
        moveTo(view);
      },
      flyTo(view) {
        stopMotion();
        const target = clampCamera(view, props.current.limits);
        if (props.current.reducedMotion) {
          moveTo(target);
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          flight.current = {
            path: flightPath(camera.current, target),
            target,
            startedAt: performance.now(),
            resolve,
          };
          requestFrame();
        });
      },
      focus: () => containerRef.current?.focus({ preventScroll: true }),
    }),
    [moveTo, requestFrame, stopMotion],
  );

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!props.current.interactive) return;
      event.preventDefault();
      stopMotion();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      // Trackpad pinches arrive as wheel events with ctrlKey: they need a stronger response.
      const factor = Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.0015));
      moveTo(zoomBy(camera.current, factor, props.current.limits));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [moveTo, stopMotion]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stopMotion();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    samples.current = [{ t: event.timeStamp, ...camera.current.center }];
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: camera.current.zoom };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !interactive) return;
    const { width, height } = size.current;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);
    const { limits: currentLimits } = props.current;
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const zoomed = clampCamera(
        {
          ...camera.current,
          zoom: (pinch.current.zoom * distance) / Math.max(1, pinch.current.distance),
        },
        currentLimits,
      );
      // Half the finger's movement: the midpoint of two fingers moves half as far.
      moveTo(
        dragBy(
          zoomed,
          (current.x - previous.x) / 2,
          (current.y - previous.y) / 2,
          width,
          height,
          currentLimits,
        ),
      );
      return;
    }
    moveTo(
      dragBy(
        camera.current,
        current.x - previous.x,
        current.y - previous.y,
        width,
        height,
        currentLimits,
      ),
    );
    samples.current.push({ t: event.timeStamp, ...camera.current.center });
    if (samples.current.length > 8) samples.current.shift();
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0 || reducedMotion) return;
    // Glide on with the speed of the last ~100 ms of dragging.
    const recent = samples.current;
    const last = recent.at(-1);
    const first = recent.find((s) => last && last.t - s.t <= 100) ?? recent[0];
    if (!last || !first || last.t - first.t < 16 || event.timeStamp - last.t > 80) return;
    const dt = last.t - first.t;
    let lon = normalizeLon(last.lon - first.lon) / dt;
    let lat = (last.lat - first.lat) / dt;
    const speed = Math.hypot(lon, lat);
    if (speed < INERTIA_STOP * 2) return;
    // A flick glides a fair way, never around the world.
    const cap = INERTIA_MAX / camera.current.zoom;
    if (speed > cap) {
      lon *= cap / speed;
      lat *= cap / speed;
    }
    inertia.current = { lon, lat, last: performance.now() };
    requestFrame();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive || event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = (
      { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const
    )[event.key as "ArrowLeft"];
    if (direction) {
      event.preventDefault();
      stopMotion();
      moveTo(nudge(camera.current, direction, event.shiftKey, limits));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      moveTo(zoomBy(camera.current, 1.5, limits));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      moveTo(zoomBy(camera.current, 1 / 1.5, limits));
    } else if (event.key === "Enter" && !event.repeat) {
      event.preventDefault();
      callbacks.current.onDrop?.();
    }
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label}
      aria-describedby={instructionsId}
      tabIndex={0}
      className={cx("relative touch-none overflow-hidden select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {crosshair ?? <DefaultCrosshair />}
      </div>
      {readout && (
        <span
          ref={readoutRef}
          aria-hidden="true"
          className={cx("pointer-events-none absolute", readoutClassName)}
        />
      )}
      {children}
      <p id={instructionsId} className="sr-only">
        {instructions}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
