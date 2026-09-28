import { devRoutesEnabled } from "@/lib/dev-routes";
import { mascot as stickerShockMascot } from "./sticker-shock/mascot";
import { theme as stickerShockTheme } from "./sticker-shock/theme";
import type { GameDefinition, LiveGameDefinition } from "./types";

// Every game's metadata, in shelf order. Metadata only: never import game components here, so the
// registry stays tiny wherever it is used (a live game's theme and mascot are plain data). `pnpm new-game` inserts new entries above the marker.
// Planned games are hidden and have no launch date yet.

export const games: readonly GameDefinition[] = [
  {
    slug: "sticker-shock",
    name: "Sticker Shock",
    tagline: "Which costs more? Every price is real, with receipts.",
    status: "live",
    // PLACEHOLDER: confirm the real launch date (the date of puzzle #1) before going to production.
    // Changing it renumbers the puzzles: run `pnpm sticker-shock:build --reset` before launch.
    launchDate: "2026-09-28",
    modes: ["daily", "unlimited"],
    engine: "choice",
    // Polls after the daily; guesses record 1 or 0 per pair (right or not) for pair_accuracy.
    usesCrowdApi: ["polls", "guesses"],
    theme: stickerShockTheme,
    mascot: stickerShockMascot,
    credits: [
      {
        what: "Flags",
        work: "flag-icons by Panayiotis Lipiridis",
        licence: "MIT License",
        url: "https://github.com/lipis/flag-icons",
      },
      {
        what: "Prices and big numbers",
        work: "Anton by Vernon Adams",
        licence: "SIL Open Font License 1.1",
        url: "https://fonts.google.com/specimen/Anton",
      },
      {
        what: "Hand-lettered signs",
        work: "Permanent Marker by Font Diner",
        licence: "Apache License 2.0",
        url: "https://fonts.google.com/specimen/Permanent+Marker",
      },
      {
        what: "Receipts",
        work: "IBM Plex Mono by IBM",
        licence: "SIL Open Font License 1.1",
        url: "https://fonts.google.com/specimen/IBM+Plex+Mono",
      },
      {
        what: "Item icons and Tag, the mascot",
        work: "drawn for Plimp",
        licence: "all rights reserved",
      },
    ],
  },
  {
    slug: "handshoe",
    name: "Handshoe",
    tagline: "Guess the thing from its literal name in another language.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "clue",
    usesCrowdApi: [],
  },
  {
    slug: "souvenir",
    name: "Souvenir",
    tagline: "Where does this English word come from? Drop a pin.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "map",
    usesCrowdApi: [],
  },
  {
    slug: "ja-nein",
    name: "Ja/Nein",
    tagline: "Vote on a real Swiss referendum, then guess the yes-share.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "estimate",
    usesCrowdApi: ["polls", "guesses"],
  },
  {
    slug: "same-boat",
    name: "Same Boat",
    tagline: "Pick a side, then guess how many players agree with you.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "estimate",
    usesCrowdApi: ["polls", "guesses"],
  },
  {
    slug: "fair-guess",
    name: "Fair Guess",
    tagline: "Guess the count in a photo, then see if the crowd beat you.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "estimate",
    usesCrowdApi: ["guesses"],
  },
  {
    slug: "tiptoe",
    name: "Tiptoe",
    tagline: "Which is worse for the climate?",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "choice",
    usesCrowdApi: [],
  },
  {
    slug: "chimp",
    name: "Chimp",
    tagline: "Three answers about the world: can you beat a random chimp?",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "choice",
    // Crowd use is optional for Chimp; decide when the game is built.
    usesCrowdApi: [],
  },
  {
    slug: "coined",
    name: "Coined",
    tagline: "Which word is older?",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "choice",
    usesCrowdApi: [],
  },
  {
    slug: "smudge",
    name: "Smudge",
    tagline: "Guess what thousands of people drew from their average doodle.",
    status: "hidden",
    modes: ["daily", "unlimited"],
    engine: "clue",
    usesCrowdApi: [],
  },
  // @new-game:entries (pnpm new-game inserts above this line)
];

export function getGame(slug: string): GameDefinition | undefined {
  return games.find((game) => game.slug === slug);
}

export function liveGames(): LiveGameDefinition[] {
  return games.filter((game): game is LiveGameDefinition => game.status === "live");
}

/** Games that appear on the shelf: live ones first, then coming-soon tiles. */
export function shelfGames(): GameDefinition[] {
  return [...liveGames(), ...games.filter((game) => game.status === "coming-soon")];
}

/**
 * Whether a game's pages and crowd writes are reachable. Live games always are; hidden and
 * coming-soon games only in development or with ENABLE_DEV_ROUTES=1 (evaluated at build time for
 * static pages).
 */
export function isGameReachable(game: GameDefinition): boolean {
  return game.status === "live" || devRoutesEnabled();
}
