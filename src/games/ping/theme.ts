import type { GameTheme } from "@/games/types";
import { HEAT, NIGHT, PAPER } from "./palette";

// Weather radar at night (dark) and a printed weather chart (light). accent1 is radar green (for
// text too), accent2 and accent3 the mild and hot ends of the heat ramp (never for text). The
// extras colour the globe (read by the map engine through var(--game-…)) and the panels.
export const theme: GameTheme = {
  light: {
    bg: PAPER.bg,
    ink: PAPER.ink,
    accent1: PAPER.radarText,
    accent2: HEAT.mild,
    accent3: HEAT.hot,
    extras: {
      panel: PAPER.panel,
      muted: PAPER.muted,
      grid: PAPER.grid,
      cold: HEAT.cold,
      ocean: PAPER.ocean,
      land: PAPER.land,
      coast: PAPER.radarLine,
      border: PAPER.border,
      rim: PAPER.ink,
      pin: PAPER.ink,
      "pin-ink": PAPER.panel,
      isobar: PAPER.isobar,
      road: PAPER.road,
    },
  },
  dark: {
    bg: NIGHT.bg,
    ink: NIGHT.ink,
    accent1: NIGHT.radar,
    accent2: HEAT.mild,
    accent3: HEAT.hot,
    extras: {
      panel: NIGHT.panel,
      muted: NIGHT.muted,
      grid: NIGHT.grid,
      cold: HEAT.cold,
      ocean: NIGHT.ocean,
      land: NIGHT.land,
      coast: NIGHT.radar,
      border: NIGHT.border,
      rim: NIGHT.radar,
      pin: NIGHT.ink,
      "pin-ink": NIGHT.bg,
      isobar: NIGHT.isobar,
      road: NIGHT.road,
    },
  },
  wordmark: "/games/ping/wordmark.svg",
};
