import { cx } from "@/frame/ui/cx";
import { HEAT, NIGHT } from "../palette";
import { strings } from "../strings";
import styles from "./demo.module.css";

/**
 * The how-to example, looping: a pin drops and misses, its ring races out and freezes with the
 * distance, then a second pin lands closer with a smaller, hotter ring. The target is made up.
 * Drawn in the night palette whatever the theme (the sheet sits outside the game world);
 * `className` carries the route's font variables. Still under reduced motion (final frame).
 */
export function HowToDemo({ className }: { className?: string }) {
  return (
    <figure role="img" aria-label={strings.demo.label} className={cx(styles.demo, className)}>
      <svg viewBox="0 0 320 200" aria-hidden="true" className={styles.svg}>
        <defs>
          <clipPath id="ping-demo-disc">
            <circle cx="160" cy="100" r="86" />
          </clipPath>
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
        <circle cx="206" cy="128" r="3" fill={HEAT.hot} className={styles.target} />

        <g className={styles.first}>
          <g clipPath="url(#ping-demo-disc)">
            <circle
              cx="120"
              cy="80"
              r="98.5"
              fill="none"
              stroke={HEAT.cold}
              strokeWidth="2.5"
              className={styles.ring1}
            />
          </g>
          <circle cx="120" cy="80" r="5" fill={NIGHT.ink} className={styles.pin1} />
          <g className={styles.label1}>
            <rect
              x="24"
              y="12"
              width="118"
              height="20"
              rx="10"
              fill={NIGHT.bg}
              stroke={HEAT.cold}
              strokeWidth="1.5"
            />
            <text x="83" y="26" textAnchor="middle" className={styles.labelText}>
              {strings.demo.first}
            </text>
          </g>
        </g>
        <g className={styles.second}>
          <g clipPath="url(#ping-demo-disc)">
            <circle
              cx="180"
              cy="120"
              r="27.2"
              fill="none"
              stroke={HEAT.hot}
              strokeWidth="2.5"
              className={styles.ring2}
            />
          </g>
          <circle cx="180" cy="120" r="5" fill={NIGHT.ink} className={styles.pin2} />
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
