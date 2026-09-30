"use client";

import { useMemo, useRef, useState } from "react";
import { frameFor } from "@/engines/map/camera";
import type { GlobeColors, GlobeScene } from "@/engines/map/draw";
import { formatDistance, formatLatLon, MAX_DISTANCE_KM, type GeoPoint } from "@/engines/map/geo";
import { Globe, type GlobeHandle } from "@/engines/map/Globe";
import { roundGeometry, type MapScoring } from "@/engines/map/scoring";
import { dropPin, startMap, type MapConfig, type MapRound } from "@/engines/map/state";
import { usePrefersReducedMotion } from "@/frame/hooks";
import { Button } from "@/frame/ui/Button";

// A made-up configuration and a fake target: this page only shows the engine at work.

const SCORING: MapScoring<"near" | "far"> = {
  maxPoints: 1000,
  decay: 0.075,
  perfect: 0.0025,
  minPerfectKm: 5,
  weights: [1, 0.5, 0.25],
  weightPerfect: false,
  bands: [
    { id: "near", maxFraction: 0.05 },
    { id: "far", maxFraction: Infinity },
  ],
};

const COLORS: GlobeColors = {
  ocean: "#0B1626",
  land: "#16304D",
  coast: "#3DDC97",
  border: "#2B4A6B",
  graticule: "#1E2E44",
  rim: "#3DDC97",
  glow: "#FFD34D",
  sweep: "#3DDC97",
  pin: "#EAF2FF",
  pinInk: "#0B1626",
  labelInk: "#EAF2FF",
  labelBg: "#0B1626",
};

const LETTERS = { n: "N", s: "S", e: "E", w: "W" };

function randomTarget(): GeoPoint {
  // Uniform on the sphere.
  const lat = (Math.asin(2 * Math.random() - 1) * 180) / Math.PI;
  return { lat, lon: Math.random() * 360 - 180 };
}

function configFor(target: GeoPoint): MapConfig<MapRound, "near" | "far"> {
  const round = { id: "fake", targets: [target], ...roundGeometry(MAX_DISTANCE_KM, SCORING) };
  return { rounds: [round], scoring: SCORING };
}

export function GlobeDemo() {
  const globe = useRef<GlobeHandle>(null);
  const reducedMotion = usePrefersReducedMotion();
  // The target is never rendered as text, so a random one cannot break hydration.
  const [target, setTarget] = useState<GeoPoint>(randomTarget);
  const config = useMemo(() => configFor(target), [target]);
  const [state, setState] = useState(() => startMap(config));
  const [startedAt, setStartedAt] = useState<number[]>([]);
  const [sweepKey, setSweepKey] = useState<string | undefined>(undefined);

  const scene = useMemo((): GlobeScene => {
    const revealed = state.phase !== "aiming";
    return {
      pins: state.pins.map((pin, i) => ({ id: `pin-${i}`, point: pin.point, label: `${i + 1}` })),
      rings: state.pins
        .filter((pin) => !pin.perfect)
        .map((pin, i) => ({
          id: `ring-${i}`,
          center: pin.point,
          radiusKm: pin.km,
          color: pin.heat > 0.5 ? "#FF5A4E" : pin.heat > 0.15 ? "#FFD34D" : "#4C8DFF",
          label: `${formatDistance(pin.km, "km")} · ${pin.band.toUpperCase()}`,
          ...(startedAt[i] !== undefined ? { startedAt: startedAt[i] } : {}),
        })),
      blips: revealed ? [{ id: "target", point: target, color: "#FF5A4E", official: true }] : [],
      glowCrossings: true,
      ...(revealed && sweepKey ? { sweep: { key: sweepKey } } : {}),
    };
  }, [state, target, startedAt, sweepKey]);

  function drop() {
    const point = globe.current?.aim();
    if (!point) return;
    const updated = dropPin(state, config, point);
    setStartedAt((s) => [...s, performance.now()]);
    setState(updated);
    if (updated.phase === "revealed") {
      void globe.current
        ?.flyTo(frameFor([target, ...updated.pins.map((p) => p.point)]))
        .then(() => setSweepKey(`sweep-${Date.now()}`));
    }
  }

  function reset() {
    const next = randomTarget();
    setTarget(next);
    setStartedAt([]);
    setSweepKey(undefined);
    setState(startMap(configFor(next)));
  }

  return (
    <div className="flex flex-col gap-3">
      <Globe
        ref={globe}
        scene={scene}
        colors={COLORS}
        font="ui-monospace"
        reducedMotion={reducedMotion}
        interactive={state.phase === "aiming"}
        label="Globe"
        instructions="Drag to turn, pinch or scroll to zoom. Arrow keys turn, plus and minus zoom, Enter drops a pin."
        describeAim={({ point, country }) =>
          `${formatLatLon(point, LETTERS)}${country ? `, ${country}` : ", open water"}`
        }
        readout={(center, zoom) => `${formatLatLon(center, LETTERS)} · ×${zoom.toFixed(1)}`}
        readoutClassName="bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 font-mono text-xs text-white"
        onDrop={drop}
        className="aspect-square w-full rounded-sheet bg-[#0B1626] text-[#3DDC97]"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={drop} disabled={state.phase !== "aiming"}>
          Drop pin ({state.pinsLeft} left)
        </Button>
        <Button onClick={reset}>New fake target</Button>
      </div>
      <p className="text-sm text-frame-muted" role="status">
        {state.phase === "aiming"
          ? `${state.pins.length} pins dropped.`
          : `Round over: ${state.answer?.score ?? 0} points${state.answer?.solved ? " (perfect)" : ""}.`}
      </p>
    </div>
  );
}
