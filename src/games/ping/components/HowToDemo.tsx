import { cx } from "@/frame/ui/cx";
import { HEAT, NIGHT } from "../palette";
import { strings } from "../strings";
import styles from "./demo.module.css";

// The first pin, the made-up target north-east of it, and the second pin, inside the first pin's
// wedge and closer: its ring reaches the target.
const PIN1 = { x: 118, y: 140 };
const TARGET = { x: 204, y: 74 };
const PIN2 = { x: 180, y: 104 };
const RING2 = Math.hypot(TARGET.x - PIN2.x, TARGET.y - PIN2.y);

/** A point `length` from the first pin at a compass bearing (degrees, north up). */
function from1(bearing: number, length: number) {
  const rad = (bearing * Math.PI) / 180;
  return { x: PIN1.x + Math.sin(rad) * length, y: PIN1.y - Math.cos(rad) * length };
}

const WEDGE = 140;
const [edgeA, edgeB] = [from1(22.5, WEDGE), from1(67.5, WEDGE)];
const ARROW = from1(45, 34);

/**
 * The how-to example, looping: a pin drops and misses, a wedge opens towards the answer (north-east)
 * with an arrow, then a second pin lands inside it, closer, and its ring freezes at the distance.
 * The target is made up. Drawn in the night palette whatever the theme (the sheet sits outside the
 * game world); `className` carries the route's font variables. Still under reduced motion (final
 * frame).
 */
export function HowToDemo({ className }: { className?: string }) {
  return (
    <figure role="img" aria-label={strings.demo.label} className={cx(styles.demo, className)}>
      <svg viewBox="0 0 320 200" aria-hidden="true" className={styles.svg}>
        <defs>
          <clipPath id="ping-demo-disc">
            <circle cx="160" cy="100" r="86" />
          </clipPath>
          <radialGradient
            id="ping-demo-fade"
            gradientUnits="userSpaceOnUse"
            cx={PIN1.x}
            cy={PIN1.y}
            r={WEDGE}
          >
            <stop offset="0" stopColor={NIGHT.radar} stopOpacity="0.45" />
            <stop offset="1" stopColor={NIGHT.radar} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" rx="14" fill={NIGHT.bg} />
        <circle
          cx="160"
          cy="100"
          r="86"
          fill={NIGHT.ocean}
          stroke={NIGHT.radar}
          strokeWidth="1.5"
        />
        <g fill="none" stroke={NIGHT.grid} strokeWidth="1">
          <ellipse cx="160" cy="100" rx="34" ry="86" />
          <ellipse cx="160" cy="100" rx="68" ry="86" />
          <path d="M74 100h172M86 57h148M86 143h148" />
        </g>
        <path
          d="M118 60c18-8 42-4 52 8s2 30-14 36-34 18-44 8-12-44 6-52Z"
          fill={NIGHT.land}
          stroke={NIGHT.radar}
          strokeWidth="1"
        />
        <circle cx={TARGET.x} cy={TARGET.y} r="3" fill={HEAT.hot} className={styles.target} />

        <g className={styles.first}>
          <g clipPath="url(#ping-demo-disc)">
            <path
              d={`M${PIN1.x} ${PIN1.y}L${edgeA.x} ${edgeA.y}A${WEDGE} ${WEDGE} 0 0 1 ${edgeB.x} ${edgeB.y}Z`}
              fill="url(#ping-demo-fade)"
              className={styles.wedge1}
            />
          </g>
          <g className={styles.label1}>
            <path
              d={`M${PIN1.x} ${PIN1.y}L${ARROW.x} ${ARROW.y}`}
              stroke={NIGHT.radar}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d={`M${ARROW.x + 5} ${ARROW.y - 5}l-11 1l10 10Z`}
              fill={NIGHT.radar}
              stroke={NIGHT.radar}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <rect
              x={ARROW.x - 46}
              y={ARROW.y - 26}
              width="30"
              height="20"
              rx="10"
              fill={NIGHT.bg}
              stroke={NIGHT.radar}
              strokeWidth="1.5"
            />
            <text
              x={ARROW.x - 31}
              y={ARROW.y - 12}
              textAnchor="middle"
              className={styles.labelText}
            >
              {strings.demo.first}
            </text>
          </g>
          <circle cx={PIN1.x} cy={PIN1.y} r="5" fill={NIGHT.ink} className={styles.pin1} />
        </g>
        <g className={styles.second}>
          <g clipPath="url(#ping-demo-disc)">
            <circle
              cx={PIN2.x}
              cy={PIN2.y}
              r={RING2}
              fill="none"
              stroke={HEAT.hot}
              strokeWidth="2.5"
              className={styles.ring2}
            />
          </g>
          <circle cx={PIN2.x} cy={PIN2.y} r="5" fill={NIGHT.ink} className={styles.pin2} />
          <g className={styles.label2}>
            <rect
              x="188"
              y="166"
              width="104"
              height="20"
              rx="10"
              fill={NIGHT.bg}
              stroke={HEAT.hot}
              strokeWidth="1.5"
            />
            <text x="240" y="180" textAnchor="middle" className={styles.labelText}>
              {strings.demo.second}
            </text>
          </g>
        </g>
      </svg>
    </figure>
  );
}
