// Ping's colours: a weather radar at night, and a printed weather chart by day. The heat ramp
// (cold → mild → hot) is the game's language and is the same in both.
//
// Light mode's radar green for text is #0B7A54, a shade darker than the #0F8A5F of the lines:
// #0F8A5F on paper is 4.0:1, short of AA for body text (unit-tested in theme.test.ts).

export const HEAT = { cold: "#4C8DFF", mild: "#FFD34D", hot: "#FF5A4E" } as const;

export const NIGHT = {
  bg: "#0B1626",
  ink: "#EAF2FF",
  radar: "#3DDC97",
  panel: "#11233B",
  muted: "#9DB0C8",
  grid: "#1E2E44",
  ocean: "#0E1D33",
  land: "#16304F",
  border: "#2A4666",
  isobar: "#16263D",
} as const;

export const PAPER = {
  bg: "#F3F6FA",
  ink: "#0B1626",
  radarText: "#0B7A54",
  radarLine: "#0F8A5F",
  panel: "#FFFFFF",
  muted: "#4B5D73",
  grid: "#C9D4E2",
  ocean: "#E3EBF4",
  land: "#FFFFFF",
  border: "#C3CFDD",
  isobar: "#D5DEE9",
} as const;
