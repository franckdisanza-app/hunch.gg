import { PALETTE } from "../palette";

/** Bar widths (1–3 units) derived from a string, so the same code always draws the same bars. */
export function barcodeWidths(code: string, bars = 28): number[] {
  let h = 2166136261;
  const widths: number[] = [];
  for (let i = 0; i < bars; i++) {
    h ^= code.charCodeAt(i % Math.max(1, code.length)) + i;
    h = Math.imul(h, 16777619) >>> 0;
    widths.push(1 + (h % 3));
  }
  return widths;
}

/** A decorative barcode. It encodes nothing; screen readers skip it. */
export function Barcode({
  code,
  width = 120,
  height = 32,
  color = PALETTE.ink,
  className,
}: {
  code: string;
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const widths = barcodeWidths(code);
  const bars = widths.map((w, i) => ({
    w,
    x: widths.slice(0, i).reduce((sum, prev) => sum + prev * 2, 0),
  }));
  const units = widths.reduce((sum, w) => sum + w * 2, 0);
  return (
    <svg
      viewBox={`0 0 ${units} 10`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {bars.map(({ w, x }, i) => (
        <rect key={i} x={x} y={0} width={w} height={10} fill={color} />
      ))}
    </svg>
  );
}
