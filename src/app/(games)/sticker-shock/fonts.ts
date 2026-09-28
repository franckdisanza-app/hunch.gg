import { Anton, IBM_Plex_Mono, Permanent_Marker } from "next/font/google";

// Sticker Shock's display fonts, loaded on its own routes only (self-hosted by next/font).
// Anton for prices and big numbers, Permanent Marker for hand-lettered signs, IBM Plex Mono for
// receipt lines. Interface text stays Inter.

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--game-font-display",
  display: "swap",
});

const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--ss-font-marker",
  display: "swap",
});

// The receipt appears after the first pick: no need to preload it.
const mono = IBM_Plex_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--ss-font-mono",
  display: "swap",
  preload: false,
});

export const fontClassName = [anton.variable, marker.variable, mono.variable].join(" ");
