import type { MascotDefinition } from "@/games/types";

// TODO: name the mascot and draw all six poses in public/games/sticker-shock/mascot/.
// Until the files exist, <Mascot> shows the neutral placeholder.
export const mascot: MascotDefinition = {
  name: "TODO",
  poses: {
    idle: "/games/sticker-shock/mascot/idle.svg",
    thinking: "/games/sticker-shock/mascot/thinking.svg",
    correct: "/games/sticker-shock/mascot/correct.svg",
    wrong: "/games/sticker-shock/mascot/wrong.svg",
    celebrate: "/games/sticker-shock/mascot/celebrate.svg",
    point: "/games/sticker-shock/mascot/point.svg",
  },
};
