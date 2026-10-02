"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, type ReactNode } from "react";
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

/** One tap on + or − doubles or halves the zoom. */
const ZOOM_STEP = 2;

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
  road: "var(--game-road)",
  place: "var(--game-ink)",
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

/** The globe's area: the isobar backdrop, the opening picture, the globe and its zoom buttons. */
export function GlobeStage({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.stage}>
      <Isobars className={styles.isobars} />
      <GlobePicture />
      {children}
    </div>
  );
}

export interface GlobeViewProps {
  scene: GlobeScene;
  initialView: Camera;
  interactive: boolean;
  reducedMotion: boolean;
  onDrop: () => void;
  onSweepEnd: (key: string) => void;
  /** Receives the globe's handle (a callback ref). */
  globeRef: (handle: GlobeHandle | null) => void;
  /** Shown over the top of the globe's area, e.g. the draft banner. */
  overlay?: ReactNode;
}

export function GlobeView({ globeRef, overlay, ...props }: GlobeViewProps) {
  const handle = useRef<GlobeHandle | null>(null);
  // The board's ref and our own, for the zoom buttons.
  const setHandle = useCallback(
    (value: GlobeHandle | null) => {
      handle.current = value;
      globeRef(value);
    },
    [globeRef],
  );
  return (
    <GlobeStage>
      <Globe
        ref={setHandle}
        {...props}
        backdrop={BACKDROP}
        colors={GLOBE_COLORS}
        font="var(--ping-font-mono)"
        label={strings.globe.label}
        instructions={strings.globe.instructions}
        describeAim={({ point, country, place }) =>
          strings.globe.aim(coordinates(point), country ?? strings.globe.openWater, place)
        }
        readout={(center) => coordinates(center)}
        readoutClassName={cx(styles.readout, styles.mono)}
        crosshair={<Crosshair />}
        // Labels keep clear of the overlay at the top, the readout and zoom buttons at the bottom.
        labelInsets={{ top: overlay ? 40 : 28, bottom: 52 }}
        className={styles.globe}
      />
      {/* Only while the player aims: the game moves the globe itself the rest of the time. */}
      {props.interactive && (
        <div className={styles.zoom}>
          <button
            type="button"
            aria-label={strings.globe.zoomOut}
            onClick={() => handle.current?.zoomBy(1 / ZOOM_STEP)}
            className={styles.zoomButton}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3 9h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={strings.globe.zoomIn}
            onClick={() => handle.current?.zoomBy(ZOOM_STEP)}
            className={styles.zoomButton}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
      {overlay}
    </GlobeStage>
  );
}
