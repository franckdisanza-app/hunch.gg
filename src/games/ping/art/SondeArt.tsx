import type { MascotPose } from "@/games/types";
import { HEAT, NIGHT } from "../palette";

// Sonde: a small white weather balloon with big round eyes and a radiosonde box on its string.
// Pure SVG (no hooks), so the same drawing renders in the game (with motion classes) and in
// `pnpm ping:art` (static poses for the shelf, on a dark mini-globe). Thick outlines and big eyes
// keep it readable at 48 px.

const INK = NIGHT.bg;
const WHITE = "#FFFFFF";

export interface SondeClasses {
  float?: string;
  balloon?: string;
  swing?: string;
  antenna?: string;
  led?: string;
  rings?: string;
}

export interface SondeArtProps {
  pose: MascotPose;
  size: number;
  /** Accessible name when the pose carries meaning; decorative otherwise. */
  title?: string;
  className?: string;
  classes?: SondeClasses;
  /** A dark mini-globe with one heat ring behind Sonde (shelf and share art). */
  backdrop?: boolean;
}

function Eyes({ pose }: { pose: MascotPose }) {
  if (pose === "celebrate") {
    // Happy, closed eyes and an open smile.
    return (
      <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M44 47 Q50 40 56 47" />
        <path d="M64 47 Q70 40 76 47" />
        <path d="M51 56 Q60 66 69 56 Z" fill={INK} strokeWidth="2.5" />
      </g>
    );
  }
  if (pose === "wrong") {
    // Droopy lids and a small frown.
    return (
      <g>
        <ellipse cx="50" cy="47" rx="5" ry="4.5" fill={INK} />
        <ellipse cx="70" cy="47" rx="5" ry="4.5" fill={INK} />
        <path d="M43 43 L56 39 M77 43 L64 39" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path
          d="M54 60 Q60 56 66 60"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    );
  }
  const look = pose === "thinking" ? [2, -3] : pose === "point" ? [3, 1] : [0, 0];
  const big = pose === "correct" ? 1.12 : 1;
  const [dx, dy] = look as [number, number];
  return (
    <g>
      {[50, 70].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx + dx} cy={45 + dy} rx={5.2 * big} ry={6.6 * big} fill={INK} />
          <circle cx={cx + dx + 1.8} cy={42 + dy} r={1.9} fill={WHITE} />
        </g>
      ))}
      <path
        d={pose === "correct" ? "M52 57 Q60 64 68 57" : "M55 58 Q60 61 65 58"}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

export function SondeArt({ pose, size, title, className, classes = {}, backdrop }: SondeArtProps) {
  const swing = pose === "point" ? "rotate(-22 60 84)" : undefined;
  const sag = pose === "wrong" ? "translate(0 3) scale(1 0.96)" : undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      data-pose={pose}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      {backdrop && (
        <g>
          <circle cx="60" cy="60" r="58" fill={NIGHT.bg} />
          <circle
            cx="60"
            cy="72"
            r="40"
            fill={NIGHT.ocean}
            stroke={NIGHT.radar}
            strokeWidth="1.5"
          />
          <g fill="none" stroke={NIGHT.grid} strokeWidth="1">
            <ellipse cx="60" cy="72" rx="16" ry="40" />
            <ellipse cx="60" cy="72" rx="32" ry="40" />
            <path d="M20 72 H100 M26 52 H94 M26 92 H94" />
          </g>
          <circle cx="78" cy="80" r="16" fill="none" stroke={HEAT.hot} strokeWidth="3" />
          <circle cx="78" cy="80" r="3" fill={HEAT.hot} />
        </g>
      )}
      {pose === "celebrate" && (
        <g className={classes.rings} fill="none" stroke={NIGHT.radar} strokeWidth="2.5">
          <circle cx="60" cy="44" r="40" opacity="0.8" />
          <circle cx="60" cy="44" r="50" opacity="0.45" />
        </g>
      )}
      <g className={classes.float} transform={pose === "celebrate" ? "translate(0 -4)" : undefined}>
        <g className={classes.swing} transform={swing}>
          <path d="M60 84 C57 91 63 97 60 103" fill="none" stroke={INK} strokeWidth="2.5" />
          <g className={classes.antenna}>
            <path d="M66 103 L71 95" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="71.5" cy="94" r="2.6" fill={INK} />
          </g>
          <rect
            x="49"
            y="102"
            width="22"
            height="15"
            rx="3.5"
            fill={HEAT.mild}
            stroke={INK}
            strokeWidth="2.5"
          />
          <circle
            className={classes.led}
            cx="55"
            cy="109.5"
            r="2.8"
            fill={pose === "correct" || pose === "celebrate" ? NIGHT.radar : INK}
          />
          <path d="M60 107 H66 M60 112 H66" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className={classes.balloon} transform={sag}>
          <path
            d="M60 10 C85 10 93 31 91 48 C89 65 74 75 64 79 L56 79 C46 75 31 65 29 48 C27 31 35 10 60 10 Z"
            fill={WHITE}
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <ellipse cx="45" cy="26" rx="7" ry="4.5" fill="#DCE7F5" transform="rotate(-28 45 26)" />
          <path
            d="M55 79 L65 79 L60 85 Z"
            fill={WHITE}
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {pose === "wrong" && (
            <path
              d="M35 58 Q38 55 36 51 M85 58 Q82 55 84 51"
              fill="none"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
          <Eyes pose={pose} />
        </g>
      </g>
    </svg>
  );
}
