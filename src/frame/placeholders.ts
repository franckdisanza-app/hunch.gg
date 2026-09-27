import type { GameTheme, MascotDefinition, UnreleasedGameDefinition } from "@/games/types";

// Neutral stand-ins used by /dev and by Mascot when a game has no art yet. Obviously fake.

export const PLACEHOLDER_THEME: GameTheme = {
  light: {
    bg: "#F4F1EA",
    ink: "#1C1B19",
    accent1: "#D9480F",
    accent2: "#1971C2",
    accent3: "#2B8A3E",
  },
  dark: {
    bg: "#1C1B19",
    ink: "#F4F1EA",
    accent1: "#FF8A50",
    accent2: "#74C0FC",
    accent3: "#8CE99A",
  },
};

export const PLACEHOLDER_MASCOT_SRC = "/placeholder/mascot.svg";

export const PLACEHOLDER_MASCOT: MascotDefinition = {
  name: "Placeholder",
  poses: {
    idle: PLACEHOLDER_MASCOT_SRC,
    thinking: PLACEHOLDER_MASCOT_SRC,
    correct: PLACEHOLDER_MASCOT_SRC,
    wrong: PLACEHOLDER_MASCOT_SRC,
    celebrate: PLACEHOLDER_MASCOT_SRC,
    point: PLACEHOLDER_MASCOT_SRC,
  },
};

/** A fake game for the /dev gallery. Never registered, never on the shelf. */
export const PLACEHOLDER_GAME: UnreleasedGameDefinition = {
  slug: "placeholder",
  name: "Placeholder Game",
  tagline: "A fake game that shows every shared component.",
  status: "hidden",
  launchDate: "2000-01-01",
  modes: ["daily", "unlimited"],
  engine: "choice",
  usesCrowdApi: ["polls", "guesses"],
  theme: PLACEHOLDER_THEME,
  mascot: PLACEHOLDER_MASCOT,
};
