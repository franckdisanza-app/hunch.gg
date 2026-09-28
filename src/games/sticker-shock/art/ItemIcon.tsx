import type { ReactNode } from "react";
import { PALETTE } from "../palette";

// Flat item icons in the flyer style, drawn for Plimp (48×48, ink outline, palette fills). The
// key is the `icon` field of items.json. Unknown keys get a plain price sticker.

const { ink, paper, red, yellow, orange, cream, white } = PALETTE;

function Shape({ d, fill, width = 2.5 }: { d: string; fill: string; width?: number }) {
  return (
    <path
      d={d}
      fill={fill}
      stroke={ink}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

function Line({ d, color = ink, width = 2 }: { d: string; color?: string; width?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const ICONS: Record<string, ReactNode> = {
  bananas: (
    <>
      <Shape
        d="M 12 12 C 11 28 26 38 42 31 C 36 29 30 29 25 25 C 19 21 16 17 16 12 Z"
        fill={yellow}
      />
      <Shape
        d="M 7 19 C 8 35 25 44 40 37 C 33 36 26 34 20 30 C 14 26 11 23 11 19 Z"
        fill={yellow}
      />
      <Line d="M 13 12 L 14 7 M 8 19 L 8 14" width={3.5} />
    </>
  ),
  apples: (
    <>
      <Shape
        d="M 24 16 C 18 11 7 13 7 25 C 7 36 15 43 20 43 C 22 43 23 42 24 42 C 25 42 26 43 28 43 C 33 43 41 36 41 25 C 41 13 30 11 24 16 Z"
        fill={red}
      />
      <Line d="M 24 16 L 25 8" width={3} />
      <Shape d="M 25 11 C 29 5 35 5 38 8 C 34 12 29 13 25 11 Z" fill={yellow} width={2} />
      <Line d="M 13 25 C 13 21 15 19 18 18" color={white} width={2.5} />
    </>
  ),
  oranges: (
    <>
      <circle cx={24} cy={27} r={16} fill={orange} stroke={ink} strokeWidth={2.5} />
      <Shape d="M 24 11 C 27 5 33 5 36 7 C 33 11 28 12 24 11 Z" fill={yellow} width={2} />
      <g fill={ink}>
        <circle cx={17} cy={24} r={1} />
        <circle cx={29} cy={21} r={1} />
        <circle cx={31} cy={32} r={1} />
        <circle cx={20} cy={34} r={1} />
      </g>
    </>
  ),
  tomatoes: (
    <>
      <ellipse cx={24} cy={28} rx={17} ry={14} fill={red} stroke={ink} strokeWidth={2.5} />
      <path d="M 24 11 L 27 17 L 34 15 L 29 20 L 24 22 L 19 20 L 14 15 L 21 17 Z" fill={ink} />
      <Line d="M 13 27 C 13 23 15 21 18 20" color={white} width={2.5} />
    </>
  ),
  potatoes: (
    <>
      <Shape
        d="M 9 27 C 7 17 19 10 30 12 C 41 14 45 24 41 32 C 37 40 23 43 15 39 C 10 37 10 31 9 27 Z"
        fill={cream}
      />
      <g fill={ink}>
        <circle cx={19} cy={22} r={1.3} />
        <circle cx={30} cy={19} r={1.3} />
        <circle cx={34} cy={30} r={1.3} />
        <circle cx={22} cy={33} r={1.3} />
      </g>
    </>
  ),
  onions: (
    <>
      <Shape
        d="M 24 8 C 26 14 40 20 40 30 C 40 38 32 43 24 43 C 16 43 8 38 8 30 C 8 20 22 14 24 8 Z"
        fill={orange}
      />
      <Line d="M 24 12 C 18 22 18 34 22 42 M 24 12 C 30 22 30 34 26 42" width={1.6} />
      <Line d="M 20 44 L 19 47 M 24 44 L 24 47 M 28 44 L 29 47" width={1.6} />
    </>
  ),
  carrots: (
    <>
      <Shape
        d="M 34 12 C 38 14 38 18 36 20 L 12 42 C 10 44 7 42 9 39 L 28 14 C 30 11 32 11 34 12 Z"
        fill={orange}
      />
      <Line d="M 22 24 L 26 27 M 17 31 L 21 33 M 26 18 L 29 20" width={1.6} />
      <Line d="M 34 12 L 39 3 M 36 15 L 45 11 M 35 13 L 44 5" width={2.6} />
    </>
  ),
  eggs: (
    <>
      <ellipse cx={14} cy={23} rx={7} ry={9} fill={white} stroke={ink} strokeWidth={2.5} />
      <ellipse cx={34} cy={23} rx={7} ry={9} fill={white} stroke={ink} strokeWidth={2.5} />
      <ellipse cx={24} cy={20} rx={7} ry={9} fill={white} stroke={ink} strokeWidth={2.5} />
      <Shape d="M 4 29 L 44 29 L 40 42 L 8 42 Z" fill={cream} />
      <Line
        d="M 12 29 C 12 34 16 34 17 29 M 22 29 C 22 34 26 34 27 29 M 31 29 C 31 34 35 34 36 29"
        width={1.6}
      />
    </>
  ),
  milk: (
    <>
      <Shape d="M 14 16 L 24 7 L 34 16 L 34 43 L 14 43 Z" fill={white} />
      <Line d="M 14 16 L 34 16" />
      <rect x={14} y={23} width={20} height={11} fill={red} stroke={ink} strokeWidth={2} />
      <path d="M 24 25 C 26.5 28 27 30 24 31.5 C 21 30 21.5 28 24 25 Z" fill={white} />
    </>
  ),
  butter: (
    <>
      <Shape d="M 6 25 L 16 17 L 42 17 L 32 25 Z" fill={yellow} />
      <Shape d="M 32 25 L 42 17 L 42 31 L 32 39 Z" fill={orange} />
      <Shape d="M 6 25 L 32 25 L 32 39 L 6 39 Z" fill={paper} />
      <rect x={6} y={29} width={26} height={5} fill={red} />
      <Line d="M 6 25 L 32 25 L 32 39 L 6 39 Z" />
    </>
  ),
  yogurt: (
    <>
      <Shape d="M 12 16 L 36 16 L 32 43 L 16 43 Z" fill={white} />
      <rect x={9} y={11} width={30} height={6} rx={2} fill={red} stroke={ink} strokeWidth={2.5} />
      <Line d="M 13 25 L 35 25 M 14 33 L 34 33" width={1.6} />
      <circle cx={24} cy={29} r={2} fill={red} />
    </>
  ),
  mozzarella: (
    <>
      <circle cx={24} cy={23} r={11} fill={white} stroke={ink} strokeWidth={2.5} />
      <Line d="M 18 20 C 19 17 21 16 23 16" color={cream} width={2.5} />
      <Shape d="M 5 30 L 43 30 C 43 38 35 44 24 44 C 13 44 5 38 5 30 Z" fill={yellow} />
    </>
  ),
  bread: (
    <>
      <Shape
        d="M 6 22 C 6 14 14 9 24 9 C 34 9 42 14 42 22 C 42 25 40 26 39 26 L 39 41 L 9 41 L 9 26 C 7 26 6 25 6 22 Z"
        fill={orange}
      />
      <Shape
        d="M 13 25 C 12 19 17 15 24 15 C 31 15 36 19 35 25 L 35 37 L 13 37 Z"
        fill={cream}
        width={2}
      />
      <Line d="M 16 12 L 19 16 M 24 10 L 25 14 M 32 12 L 30 16" width={1.6} />
    </>
  ),
  rice: (
    <>
      <Shape d="M 12 12 L 36 12 L 39 43 L 9 43 Z" fill={white} />
      <Shape d="M 12 12 L 14 6 L 34 6 L 36 12 Z" fill={paper} width={2} />
      <rect x={13} y={21} width={22} height={13} fill={red} stroke={ink} strokeWidth={2} />
      <g fill={white}>
        <ellipse cx={19} cy={27.5} rx={1.4} ry={2.4} transform="rotate(30 19 27.5)" />
        <ellipse cx={24} cy={26} rx={1.4} ry={2.4} />
        <ellipse cx={29} cy={27.5} rx={1.4} ry={2.4} transform="rotate(-30 29 27.5)" />
      </g>
    </>
  ),
  spaghetti: (
    <>
      <Shape d="M 13 43 L 27 5 L 35 8 L 21 45 Z" fill={yellow} />
      <Line d="M 17 43 L 30 7 M 20 44 L 33 8" width={1.3} />
      <Shape d="M 14 24 L 30 30 L 28 35 L 12 29 Z" fill={red} width={2} />
    </>
  ),
  flour: (
    <>
      <Shape d="M 10 14 C 10 9 38 9 38 14 L 41 40 C 41 44 7 44 7 40 Z" fill={paper} />
      <Line d="M 16 11 C 20 14 28 14 32 11" width={2} />
      <Line d="M 24 38 L 24 20" color={red} width={2.2} />
      <g fill={red}>
        <ellipse cx={20.5} cy={24} rx={2.2} ry={3.4} transform="rotate(-35 20.5 24)" />
        <ellipse cx={27.5} cy={24} rx={2.2} ry={3.4} transform="rotate(35 27.5 24)" />
        <ellipse cx={20.5} cy={31} rx={2.2} ry={3.4} transform="rotate(-35 20.5 31)" />
        <ellipse cx={27.5} cy={31} rx={2.2} ry={3.4} transform="rotate(35 27.5 31)" />
        <ellipse cx={24} cy={18} rx={2.2} ry={3.4} />
      </g>
    </>
  ),
  sugar: (
    <>
      <Shape d="M 6 28 L 20 28 L 20 42 L 6 42 Z" fill={white} />
      <Shape d="M 22 28 L 36 28 L 36 42 L 22 42 Z" fill={white} />
      <Shape d="M 14 12 L 28 12 L 28 26 L 14 26 Z" fill={white} />
      <Shape d="M 28 12 L 33 8 L 33 22 L 28 26 Z" fill={cream} width={2} />
      <Shape d="M 14 12 L 19 8 L 33 8 L 28 12 Z" fill={paper} width={2} />
    </>
  ),
  "olive-oil": (
    <>
      <Shape
        d="M 20 8 L 28 8 L 28 13 C 34 17 36 21 36 27 L 36 42 C 36 44 12 44 12 42 L 12 27 C 12 21 14 17 20 13 Z"
        fill={yellow}
      />
      <rect
        x={18.5}
        y={3}
        width={11}
        height={6}
        rx={1.5}
        fill={red}
        stroke={ink}
        strokeWidth={2.5}
      />
      <rect x={14} y={28} width={20} height={10} fill={paper} stroke={ink} strokeWidth={2} />
      <ellipse cx={24} cy={33} rx={3.2} ry={2.4} fill={ink} />
    </>
  ),
  coffee: (
    <>
      <Shape d="M 12 11 L 36 11 L 39 43 L 9 43 Z" fill={ink} />
      <Shape d="M 12 11 L 13 5 L 35 5 L 36 11 Z" fill={ink} width={2} />
      <Line d="M 13 8 L 35 8" color={paper} width={1.4} />
      <circle cx={24} cy={27} r={8.5} fill={yellow} stroke={ink} strokeWidth={2} />
      <ellipse cx={24} cy={27} rx={3.5} ry={5.5} fill={ink} transform="rotate(25 24 27)" />
      <Line d="M 22.5 23 C 25 26 23 29 25.5 31" color={yellow} width={1.2} />
    </>
  ),
  chicken: (
    <>
      <Shape d="M 13 35 C 5 27 9 10 22 8 C 35 6 43 17 38 27 C 36 31 32 33 28 31 Z" fill={orange} />
      <Line d="M 28 31 L 36 39" color={ink} width={7} />
      <Line d="M 28 31 L 36 39" color={white} width={3.5} />
      <circle cx={36} cy={42} r={3.2} fill={white} stroke={ink} strokeWidth={2} />
      <circle cx={40} cy={38} r={3.2} fill={white} stroke={ink} strokeWidth={2} />
      <Line d="M 15 20 C 16 16 19 14 22 13" color={yellow} width={2.4} />
    </>
  ),
  chocolate: (
    <>
      <Shape d="M 7 10 L 41 10 L 41 22 L 7 22 Z" fill={ink} />
      <Line d="M 18 10 L 18 22 M 30 10 L 30 22 M 7 16 L 41 16" color={paper} width={1.2} />
      <Shape d="M 7 20 L 41 17 L 41 41 L 7 41 Z" fill={red} />
      <Line d="M 7 32 L 41 30" color={white} width={2.4} />
    </>
  ),
  water: (
    <>
      <Shape
        d="M 20 8 L 28 8 L 28 11 C 33 13 34 17 34 21 L 34 42 C 34 44 14 44 14 42 L 14 21 C 14 17 15 13 20 11 Z"
        fill={white}
      />
      <rect
        x={19}
        y={3}
        width={10}
        height={6}
        rx={1.5}
        fill={orange}
        stroke={ink}
        strokeWidth={2.5}
      />
      <rect x={14} y={25} width={20} height={10} fill={red} stroke={ink} strokeWidth={2} />
      <path d="M 24 26.5 C 26.2 29 26.7 31 24 33 C 21.3 31 21.8 29 24 26.5 Z" fill={white} />
      <Line d="M 16 38 L 32 38" width={1.3} />
    </>
  ),
  cola: (
    <>
      <Shape
        d="M 21 9 L 27 9 L 27 13 C 31 16 32 19 32 23 L 32 42 C 32 44 16 44 16 42 L 16 23 C 16 19 17 16 21 13 Z"
        fill={ink}
      />
      <rect
        x={19.5}
        y={3}
        width={9}
        height={6}
        rx={1.5}
        fill={red}
        stroke={ink}
        strokeWidth={2.5}
      />
      <rect x={16} y={26} width={16} height={9} fill={yellow} stroke={ink} strokeWidth={2} />
      <g fill={white}>
        <circle cx={20} cy={40} r={1} />
        <circle cx={26} cy={38.5} r={1.2} />
        <circle cx={23} cy={20} r={1} />
      </g>
    </>
  ),
  "orange-juice": (
    <>
      <Shape d="M 12 16 L 24 7 L 36 16 L 36 43 L 12 43 Z" fill={orange} />
      <Line d="M 12 16 L 36 16" />
      <circle cx={24} cy={29} r={8} fill={white} stroke={ink} strokeWidth={2} />
      <circle cx={24} cy={29} r={5} fill={yellow} />
      <Line
        d="M 24 24 L 24 34 M 19.7 26.5 L 28.3 31.5 M 19.7 31.5 L 28.3 26.5"
        color={white}
        width={1.1}
      />
    </>
  ),
  beer: (
    <>
      <Shape d="M 32 19 C 43 19 43 36 32 36" fill="none" width={3.5} />
      <Shape d="M 9 14 L 32 14 L 32 43 L 9 43 Z" fill={yellow} />
      <Shape
        d="M 7 15 C 6 9 12 7 15 9 C 17 5 25 5 27 9 C 30 6 36 8 34 15 Z"
        fill={white}
        width={2.2}
      />
      <g fill={white}>
        <circle cx={15} cy={28} r={1.3} />
        <circle cx={24} cy={34} r={1.3} />
        <circle cx={20} cy={22} r={1.1} />
      </g>
    </>
  ),
};

export const ITEM_ICON_KEYS = Object.keys(ICONS);

export function ItemIcon({
  icon,
  size = 48,
  className,
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {ICONS[icon] ?? (
        <path
          d="M 8 24 L 24 8 L 40 8 L 40 24 L 24 40 Z"
          fill={yellow}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
