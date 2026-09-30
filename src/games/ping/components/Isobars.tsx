// Thin isobar-style contour lines behind the globe: a high and a low, as on a weather chart.
// Decorative only.

const HIGH = [
  "M112 58c30-14 72-6 84 20s-4 58-38 66-70-4-80-30 4-42 34-56Z",
  "M96 40c44-24 110-12 128 26s-8 90-58 102-104-6-118-44 4-60 48-84Z",
  "M78 22c58-34 150-20 172 32s-10 122-78 138-140-8-158-58 6-78 64-112Z",
];

const LOW = [
  "M300 250c22-10 50-2 56 18s-8 40-32 44-46-8-50-26 4-26 26-36Z",
  "M284 232c36-18 82-6 92 28s-14 66-52 72-76-12-82-42 6-42 42-58Z",
  "M266 212c50-26 116-10 130 38s-20 94-74 102-108-16-116-60 8-56 60-80Z",
];

export function Isobars({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 380"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        {[...HIGH, ...LOW].map((d) => (
          <path key={d} d={d} />
        ))}
        <path d="M0 190c60-24 120 10 190-8s130-70 230-40" />
        <path d="M0 330c80-30 140 6 220-10s120-40 200-20" />
      </g>
      <g
        fill="currentColor"
        fontFamily="var(--ping-font-mono), monospace"
        fontSize="14"
        fontWeight="700"
      >
        <text x="150" y="104">
          H
        </text>
        <text x="318" y="286">
          L
        </text>
      </g>
    </svg>
  );
}
