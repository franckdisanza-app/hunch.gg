import type { GameTheme } from "@/games/types";

// TODO: Ping's own palette (4–5 colours) plus a dark variant, and a wordmark image of the name
// in the display font (theme.wordmark). Ink on bg must reach 4.5:1 in both modes (unit-tested
// once the game is coming-soon or live).
export const theme: GameTheme = {
  light: {
    bg: "#FFFFFF",
    ink: "#111111",
    accent1: "#444444",
    accent2: "#666666",
    accent3: "#888888",
  },
  dark: {
    bg: "#111111",
    ink: "#F2F2F2",
    accent1: "#BBBBBB",
    accent2: "#999999",
    accent3: "#777777",
  },
};
