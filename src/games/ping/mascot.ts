import type { MascotDefinition } from "@/games/types";

// Sonde: a small white weather balloon with big round eyes and a radiosonde box on its string, an
// eager explorer that drifts to the edges of the world and reports back. The game draws Sonde
// inline with motion (art/Sonde.tsx); these static poses, on a dark mini-globe with one heat
// ring, are for the shelf and anything else outside the game. Regenerate with `pnpm ping:art`.
export const mascot: MascotDefinition = {
  name: "Sonde",
  poses: {
    idle: "/games/ping/mascot/idle.svg",
    thinking: "/games/ping/mascot/thinking.svg",
    correct: "/games/ping/mascot/correct.svg",
    wrong: "/games/ping/mascot/wrong.svg",
    celebrate: "/games/ping/mascot/celebrate.svg",
    point: "/games/ping/mascot/point.svg",
  },
};
