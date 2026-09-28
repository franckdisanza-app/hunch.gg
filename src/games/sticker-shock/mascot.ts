import type { MascotDefinition } from "@/games/types";

// Tag: a paper price tag on a string, an excitable bargain hunter. The game draws Tag inline with
// motion (art/Tag.tsx); these static poses, on a yellow starburst, are for the shelf and anything
// else outside the game. Regenerate them with `pnpm sticker-shock:art`.
export const mascot: MascotDefinition = {
  name: "Tag",
  poses: {
    idle: "/games/sticker-shock/mascot/idle.svg",
    thinking: "/games/sticker-shock/mascot/thinking.svg",
    correct: "/games/sticker-shock/mascot/correct.svg",
    wrong: "/games/sticker-shock/mascot/wrong.svg",
    celebrate: "/games/sticker-shock/mascot/celebrate.svg",
    point: "/games/sticker-shock/mascot/point.svg",
  },
};
