"use client";

import dynamic from "next/dynamic";
import type { Ref } from "react";
import type { GlobeColors, GlobeScene } from "@/engines/map/draw";
import { formatLatLon, type GeoPoint } from "@/engines/map/geo";
import type { Camera } from "@/engines/map/camera";
import type { GlobeHandle } from "@/engines/map/Globe";
import { cx } from "@/frame/ui/cx";
import { WORLD_VIEW } from "../config";
import { HEAT } from "../palette";
import { strings } from "../strings";
import { GlobePicture, globePictureVisible } from "./GlobePicture";
import { Isobars } from "./Isobars";
import styles from "./world.module.css";

// The globe loads on its own after the page: the map engine, d3-geo and the land shapes never
// weigh on the first paint (and the shelf never loads any of it).
const Globe = dynamic(() => import("@/engines/map/Globe").then((m) => m.Globe), {
  ssr: false,
  // The globe picture underneath stands in until then.
  loading: () => (
    <p className="sr-only" role="status">
      {strings.globe.loading}
    </p>
  ),
});

/** The globe picture underneath shows the world view: the canvas leaves it be until it changes. */
const BACKDROP = { view: WORLD_VIEW, visible: globePictureVisible };

/** The globe in Ping's colours: var() references follow the light and dark themes. */
export const GLOBE_COLORS: GlobeColors = {
  ocean: "var(--game-ocean)",
  land: "var(--game-land)",
  coast: "var(--game-coast)",
  border: "var(--game-border)",
  graticule: "var(--game-grid)",
  rim: "var(--game-rim)",
  glow: HEAT.mild,
  sweep: "var(--game-accent-1)",
  pin: "var(--game-pin)",
  pinInk: "var(--game-pin-ink)",
  labelInk: "var(--game-ink)",
  labelBg: "var(--game-bg)",
};

const coordinates = (point: GeoPoint) => formatLatLon(point, strings.globe.letters);

function Crosshair() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r="10" fill="none" stroke="var(--game-bg)" strokeWidth="5" />
      <path d="M23 2v11M23 33v11M2 23h11M33 23h11" stroke="var(--game-bg)" strokeWidth="5" />
      <circle cx="23" cy="23" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M23 2v11M23 33v11M2 23h11M33 23h11" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="23" cy="23" r="1.8" fill="currentColor" />
    </svg>
  );
}

export interface GlobeViewProps {
  scene: GlobeScene;
  initialView: Camera;
  interactive: boolean;
  reducedMotion: boolean;
  onDrop: () => void;
  onSweepEnd: (key: string) => void;
  globeRef: Ref<GlobeHandle>;
}

export function GlobeView({ globeRef, ...props }: GlobeViewProps) {
  return (
    <div className={styles.globeWrap}>
      <Isobars className={styles.isobars} />
      <GlobePicture />
      <Globe
        ref={globeRef}
        {...props}
        backdrop={BACKDROP}
        colors={GLOBE_COLORS}
        font="var(--ping-font-mono)"
        label={strings.globe.label}
        instructions={strings.globe.instructions}
        describeAim={({ point, country }) =>
          strings.globe.aim(coordinates(point), country ?? strings.globe.openWater)
        }
        readout={(center) => coordinates(center)}
        readoutClassName={cx(styles.readout, styles.mono)}
        crosshair={<Crosshair />}
        className={styles.globe}
      />
    </div>
  );
}
