import type { MascotPose } from "@/games/types";
import { PALETTE } from "../palette";
import { starburstPoints } from "./Starburst";

// Tag, Sticker Shock's mascot: a paper price tag on a string, with big round eyes and a tiny red
// sticker on its cheek. An excitable bargain hunter. Pure SVG with fixed colours, so the same
// drawing is used in the game (Tag.tsx adds motion) and exported as static files for the shelf.
//
// 120×120 box. The string hangs from (56, 4); the tag body has an angled left end and a punched
// hole at (40, 72). A paper-coloured die-cut edge keeps the ink outline visible on dark screens.

export interface TagClasses {
  /** The whole character, rotating around the top of the string (idle swing, jolt). */
  swing?: string;
  /** The tag body and face (celebrate spin). */
  body?: string;
  /** The burst of mini stickers (celebrate). */
  burst?: string;
  /** The sparkle (correct). */
  sparkle?: string;
}

export interface TagArtProps {
  pose?: MascotPose;
  /** Rendered size in CSS pixels. Outlines thicken at small sizes so Tag reads at 48 px. */
  size?: number;
  /** A yellow starburst behind Tag (the shelf tile). */
  backdrop?: boolean;
  /** Accessible name; decorative (aria-hidden) when omitted. */
  title?: string;
  classes?: TagClasses;
  className?: string;
}

const { ink, cream, white, red, yellow, orange, paper } = PALETTE;

const BODY =
  "M 26 58 L 44 38 L 106 38 Q 112 38 112 44 L 112 100 Q 112 106 106 106 L 44 106 L 26 86 Z";
const STRING = "M 40 67 Q 30 48 46 30 T 56 4";
// The string lets go of its hook and curls into an arrow pointing down and right, at the reveal.
const POINT_STRING =
  "M 40 67 C 30 42 40 14 60 12 C 76 10 80 28 67 28 C 56 28 64 8 86 8 C 102 8 112 16 114 30";
const POINT_HEAD = "M 104 26 L 114.5 33 L 119 21";

interface Face {
  eyes: "round" | "happy" | "huge";
  pupils: [number, number];
  brows: [string, string];
  mouth: { d: string; fill?: string };
}

const FACES: Record<MascotPose, Face> = {
  idle: {
    eyes: "round",
    pupils: [1, 2],
    brows: ["M 58 48 Q 66 44 74 48", "M 84 48 Q 92 44 100 48"],
    mouth: { d: "M 72 88 Q 79 95 86 88" },
  },
  thinking: {
    eyes: "round",
    pupils: [-3, -4],
    brows: ["M 58 44 Q 66 37 74 43", "M 84 50 L 100 48"],
    mouth: { d: "M 73 91 L 86 88" },
  },
  correct: {
    eyes: "happy",
    pupils: [0, 0],
    brows: ["M 58 46 Q 66 41 74 46", "M 84 46 Q 92 41 100 46"],
    mouth: { d: "M 64 81 Q 79 102 94 81 Z", fill: ink },
  },
  wrong: {
    eyes: "huge",
    pupils: [0, 0],
    brows: ["M 55 44 Q 63 36 72 41", "M 86 41 Q 95 36 103 44"],
    mouth: { d: "M 79 86 m -5 0 a 5 6.5 0 1 0 10 0 a 5 6.5 0 1 0 -10 0 Z", fill: ink },
  },
  celebrate: {
    eyes: "happy",
    pupils: [0, 0],
    brows: ["M 58 45 Q 66 39 74 45", "M 84 45 Q 92 39 100 45"],
    mouth: { d: "M 68 83 Q 79 99 90 83 Z", fill: ink },
  },
  point: {
    eyes: "round",
    pupils: [4, 3],
    brows: ["M 58 47 Q 66 43 74 47", "M 84 46 Q 92 42 100 46"],
    mouth: { d: "M 73 88 Q 80 93 87 87" },
  },
};

const EYES: [number, number][] = [
  [66, 64],
  [92, 64],
];

export function TagArt({
  pose = "idle",
  size = 120,
  backdrop = false,
  title,
  classes = {},
  className,
}: TagArtProps) {
  const face = FACES[pose];
  // Thicker lines when small: about 2.4 px at 48 px, 3.5 px at 120 px.
  const outline = size <= 64 ? 6 : size <= 96 ? 4.5 : 3.5;
  const detail = outline * 0.85;
  const halo = outline + 5;
  const string = pose === "point" ? POINT_STRING : STRING;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-pose={pose}
      overflow="visible"
    >
      {backdrop && (
        <polygon
          points={starburstPoints(60, 60, 58, 49, 18, -8)}
          fill={yellow}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
      <g transform={backdrop ? "translate(17 17) scale(0.72)" : undefined}>
        <g className={classes.swing} data-part="swing">
          {/* String, with a paper edge so it shows on dark backgrounds. */}
          <path d={string} fill="none" stroke={paper} strokeWidth={halo} strokeLinecap="round" />
          <path
            d={string}
            fill="none"
            stroke={ink}
            strokeWidth={outline * 0.7}
            strokeLinecap="round"
          />
          {pose === "point" &&
            [
              { stroke: paper, width: halo },
              { stroke: ink, width: outline * 0.8 },
            ].map(({ stroke, width }) => (
              <path
                key={stroke}
                d={POINT_HEAD}
                fill="none"
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          <g className={classes.body}>
            <path d={BODY} fill={paper} stroke={paper} strokeWidth={halo} strokeLinejoin="round" />
            <path d={BODY} fill={cream} stroke={ink} strokeWidth={outline} strokeLinejoin="round" />
            {/* The punched hole, with the string through it. */}
            <circle cx={40} cy={72} r={5} fill={paper} stroke={ink} strokeWidth={detail * 0.7} />

            {EYES.map(([cx, cy], i) =>
              face.eyes === "happy" ? (
                <path
                  key={i}
                  d={`M ${cx - 9} ${cy + 3} Q ${cx} ${cy - 9} ${cx + 9} ${cy + 3}`}
                  fill="none"
                  stroke={ink}
                  strokeWidth={detail * 1.1}
                  strokeLinecap="round"
                />
              ) : (
                <g key={i}>
                  <circle
                    cx={face.eyes === "huge" ? cx + (i === 0 ? -1 : 1) : cx}
                    cy={cy}
                    r={face.eyes === "huge" ? 13 : 11}
                    fill={white}
                    stroke={ink}
                    strokeWidth={detail}
                  />
                  <circle
                    cx={cx + face.pupils[0]}
                    cy={cy + face.pupils[1]}
                    r={face.eyes === "huge" ? 2.2 : 4.8}
                    fill={ink}
                  />
                </g>
              ),
            )}
            {face.brows.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={ink}
                strokeWidth={detail}
                strokeLinecap="round"
              />
            ))}
            <path
              d={face.mouth.d}
              fill={face.mouth.fill ?? "none"}
              stroke={ink}
              strokeWidth={detail}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {(pose === "correct" || pose === "celebrate") && (
              <ellipse cx={79} cy={pose === "correct" ? 90 : 90} rx={5} ry={3} fill={red} />
            )}
            {/* The tiny red sticker on its cheek. */}
            <polygon
              points={starburstPoints(102, 89, 7, 5, 8, 10)}
              fill={red}
              stroke={ink}
              strokeWidth={detail * 0.5}
            />
            {pose === "thinking" && (
              <g fill="none" stroke={ink} strokeWidth={detail} strokeLinecap="round">
                <path d="M 47 84 Q 47 78 52 78 Q 57 78 57 83 Q 57 88 52 89 L 52 93" />
                <circle cx={52} cy={99} r={1.2} fill={ink} />
              </g>
            )}
          </g>
          {pose === "wrong" && (
            <path
              d="M 106 14 Q 113 26 106 31 Q 99 26 106 14 Z"
              fill={white}
              stroke={ink}
              strokeWidth={detail * 0.7}
            />
          )}
        </g>
        {pose === "correct" && (
          <g className={classes.sparkle}>
            <path
              d="M 106 10 L 109 20 L 119 23 L 109 26 L 106 36 L 103 26 L 93 23 L 103 20 Z"
              fill={yellow}
              stroke={ink}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <path
              d="M 16 22 L 18 28 L 24 30 L 18 32 L 16 38 L 14 32 L 8 30 L 14 28 Z"
              fill={yellow}
              stroke={ink}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </g>
        )}
        {pose === "celebrate" && (
          <g className={classes.burst}>
            {(
              [
                [12, 30, red],
                [100, 16, yellow],
                [112, 64, orange],
                [10, 100, yellow],
                [94, 112, red],
                [30, 112, orange],
              ] as const
            ).map(([x, y, fill], i) => (
              <polygon
                key={i}
                points={starburstPoints(x, y, 7, 5, 10, i * 12)}
                fill={fill}
                stroke={ink}
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
      </g>
      {title && <title>{title}</title>}
    </svg>
  );
}
