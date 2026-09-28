// Sticker Shock's flyer palette. Flat colour only, no gradients. Paper things (shelf labels, the
// receipt, Tag) keep their paper colours in dark mode ("night shift"): only the background changes.

export const PALETTE = {
  /** Receipt white: paper, labels, the light background. */
  paper: "#FAF7F0",
  ink: "#1B1B1B",
  /** Sale red: strips, stickers (white text on it), large text only. */
  red: "#E4002B",
  /** Sticker yellow: starbursts, the sign. */
  yellow: "#FFD600",
  /** Neon orange: accents. */
  orange: "#FF7A1A",
  /** Night shift background. */
  night: "#141414",
  /** Tag's body. */
  cream: "#F7E6BF",
  white: "#FFFFFF",
} as const;
