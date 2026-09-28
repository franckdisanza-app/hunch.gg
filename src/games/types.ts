// The game plugin contract. Types only (no runtime code), so any module can import it cheaply.
// Runtime validation of registry entries lives in registry.schema.ts.

export const GAME_STATUSES = ["hidden", "coming-soon", "live"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_MODES = ["daily", "unlimited"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_ENGINES = ["choice", "estimate", "clue", "map"] as const;
export type GameEngine = (typeof GAME_ENGINES)[number];

/** Which crowd endpoints a game writes to: one-tap polls (/api/vote) and numeric guesses (/api/guess). */
export const CROWD_FEATURES = ["polls", "guesses"] as const;
export type CrowdFeature = (typeof CROWD_FEATURES)[number];

export const MASCOT_POSES = ["idle", "thinking", "correct", "wrong", "celebrate", "point"] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

/** Colours as #RGB or #RRGGBB hex strings. */
export interface ThemeTokens {
  bg: string;
  ink: string;
  accent1: string;
  accent2: string;
  accent3: string;
  /** Optional extra colours, exposed as --game-<name> (kebab-case names). */
  extras?: Record<string, string>;
}

export interface GameTheme {
  light: ThemeTokens;
  dark: ThemeTokens;
  /**
   * The game's name set in its display font, as an image (usually SVG, under
   * /public/games/<slug>/). The shelf shows it so it never has to download game fonts.
   * Without it the shelf falls back to the name in Inter.
   */
  wordmark?: string;
}

export interface MascotDefinition {
  name: string;
  /** One image path per pose, e.g. /games/<slug>/mascot/idle.svg */
  poses: Record<MascotPose, string>;
}

/** Third-party work a game uses (fonts, icons, data), credited on the About page. */
export interface GameCredit {
  /** What it is used for, e.g. "Flags". */
  what: string;
  /** Name of the work and its author, e.g. "flag-icons by Panayiotis Lipiridis". */
  work: string;
  /** e.g. "MIT", "SIL Open Font License 1.1", "ODbL 1.0". */
  licence: string;
  /** Where the work lives; leave out for work made for Plimp. */
  url?: string;
}

interface GameBase {
  /** URL segment and storage namespace: lowercase letters, digits and dashes. */
  slug: string;
  name: string;
  /** One sentence. */
  tagline: string;
  modes: readonly GameMode[];
  engine: GameEngine;
  /** Empty when the game does not use the crowd API. */
  usesCrowdApi: readonly CrowdFeature[];
  /** Fonts, art and data sources to credit on the About page once the game is live. */
  credits?: readonly GameCredit[];
}

export interface LiveGameDefinition extends GameBase {
  status: "live";
  /** YYYY-MM-DD, the date of puzzle #1 (in the player's own time zone). */
  launchDate: string;
  theme: GameTheme;
  mascot: MascotDefinition;
}

export interface UnreleasedGameDefinition extends GameBase {
  status: "hidden" | "coming-soon";
  launchDate?: string;
  theme?: GameTheme;
  mascot?: MascotDefinition;
}

export type GameDefinition = LiveGameDefinition | UnreleasedGameDefinition;
