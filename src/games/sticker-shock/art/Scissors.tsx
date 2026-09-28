import { PALETTE } from "../palette";

/** A small pair of scissors for the dashed cut-here lines. */
export function Scissors({ size = 20, color = PALETTE.ink }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
        <circle cx={6} cy={6} r={3} />
        <circle cx={6} cy={18} r={3} />
        <path d="M 8.5 7.5 L 21 17 M 8.5 16.5 L 21 7 M 13 12 L 14 12" />
      </g>
    </svg>
  );
}
