import type { ReactNode, SVGProps } from "react";
import { PALETTE } from "../palette";

/** Points of a starburst polygon: `points` spikes between radius `inner` and `outer`. */
export function starburstPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  rotation = 0,
): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((rotation - 90) * Math.PI) / 180 + (i * Math.PI) / points;
    coords.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return coords.join(" ");
}

export interface StarburstProps extends Omit<SVGProps<SVGSVGElement>, "children" | "points"> {
  /** 16–20 spikes look like a price sticker. */
  points?: number;
  /** Degrees; a few degrees off straight reads as hand-applied. */
  tilt?: number;
  fill?: string;
  outline?: string;
  children?: ReactNode;
}

/** A flat price-sticker starburst. Children are drawn on top, in a 100×100 box. */
export function Starburst({
  points = 18,
  tilt = -6,
  fill = PALETTE.yellow,
  outline = PALETTE.ink,
  children,
  ...svg
}: StarburstProps) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" {...svg}>
      <polygon
        points={starburstPoints(50, 50, 48, 40, points, tilt)}
        fill={fill}
        stroke={outline}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {children}
    </svg>
  );
}
