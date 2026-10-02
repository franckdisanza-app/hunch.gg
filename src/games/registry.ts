import { devRoutesEnabled } from "@/lib/dev-routes";
import { mascot as pingMascot } from "./ping/mascot";
import { theme as pingTheme } from "./ping/theme";
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
    slug: "ping",
    name: "Ping",
    tagline: "Pin the world's extremes: hottest, wettest, farthest.",
    status: "live",
    // PLACEHOLDER: confirm the real launch date (the date of puzzle #1) before going to production.
    // Changing it renumbers the puzzles: run `pnpm ping:build --reset` before launch.
    launchDate: "2026-09-26",
    modes: ["daily", "unlimited"],
    engine: "map",
    // Guesses record each question's first-pin distance in km, for difficulty tuning.
    usesCrowdApi: ["guesses"],
    theme: pingTheme,
    mascot: pingMascot,
    credits: [
      {
        what: "Headings and big numbers",
        work: "Unbounded by The Unbounded Project Authors",
        licence: "SIL Open Font License 1.1",
        url: "https://github.com/googlefonts/unbounded",
      },
      {
        what: "Radar readouts",
        work: "JetBrains Mono by The JetBrains Mono Project Authors",
        licence: "SIL Open Font License 1.1",
        url: "https://github.com/JetBrains/JetBrainsMono",
      },
      {
        what: "Land and country shapes",
        work: "Natural Earth, via world-atlas by Mike Bostock",
        licence: "Public domain (Natural Earth), ISC License (world-atlas)",
        url: "https://github.com/topojson/world-atlas",
      },
      {
        what: "Cities and roads on the globe",
        work: "Natural Earth (populated places and roads, 1:10m)",
        licence: "Public domain",
        url: "https://www.naturalearthdata.com/",
      },
      {
        what: "Computed questions",
        work: "OpenStreetMap contributors",
        licence: "Open Database License (ODbL) 1.0",
        url: "https://www.openstreetmap.org/copyright",
      },
      {
        what: "Sonde, the icons and the weather-chart art",
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
