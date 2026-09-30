import { JetBrains_Mono, Unbounded } from "next/font/google";

// Ping's fonts, loaded on its own routes only (self-hosted by next/font): Unbounded for headings
// and big numbers, JetBrains Mono for radar readouts. Interface text stays Inter.

const unbounded = Unbounded({
  weight: "800",
  subsets: ["latin"],
  variable: "--game-font-display",
  display: "swap",
});

// Readouts only appear once the game has loaded: no preload competing with the first paint.
const mono = JetBrains_Mono({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--ping-font-mono",
  display: "swap",
  preload: false,
});

export const fontClassName = [unbounded.variable, mono.variable].join(" ");
