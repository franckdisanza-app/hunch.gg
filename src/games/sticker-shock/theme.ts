import type { GameTheme } from "@/games/types";
import { PALETTE } from "./palette";

// Supermarket-flyer maximalism: receipt white, ink, sale red, sticker yellow, neon orange. Dark
// mode ("night shift") swaps the background and ink; paper stays paper. Ink on bg is 16.5:1 in
// both modes (unit-tested for every live game).
export const theme: GameTheme = {
  light: {
    bg: PALETTE.paper,
    ink: PALETTE.ink,
    accent1: PALETTE.red,
    accent2: PALETTE.yellow,
    accent3: PALETTE.orange,
    extras: { paper: PALETTE.paper, "paper-ink": PALETTE.ink, shadow: PALETTE.ink },
  },
  dark: {
    bg: PALETTE.night,
    ink: PALETTE.paper,
    accent1: PALETTE.red,
    accent2: PALETTE.yellow,
    accent3: PALETTE.orange,
    // Hard shadows turn to paper-coloured outlines at night, so labels still stand out.
    extras: { paper: PALETTE.paper, "paper-ink": PALETTE.ink, shadow: "#000000" },
  },
  wordmark: "/games/sticker-shock/wordmark.svg",
};
