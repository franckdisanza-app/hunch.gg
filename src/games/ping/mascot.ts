import type { MascotDefinition } from "@/games/types";

// TODO: name the mascot and draw all six poses in public/games/ping/mascot/.
// Until the files exist, <Mascot> shows the neutral placeholder.
export const mascot: MascotDefinition = {
  name: "TODO",
  poses: {
    idle: "/games/ping/mascot/idle.svg",
    thinking: "/games/ping/mascot/thinking.svg",
    correct: "/games/ping/mascot/correct.svg",
    wrong: "/games/ping/mascot/wrong.svg",
    celebrate: "/games/ping/mascot/celebrate.svg",
    point: "/games/ping/mascot/point.svg",
  },
};
