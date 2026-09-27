import { readFileSync } from "node:fs";
import { PLACEHOLDER_GAME, PLACEHOLDER_THEME } from "@/frame/placeholders";
import { AA_NORMAL_TEXT, contrastRatio } from "@/lib/color";
import { games, getGame, isGameReachable, liveGames, shelfGames } from "./registry";
import { gameDefinitionSchema, validateRegistry } from "./registry.schema";
import type { GameTheme } from "./types";

describe("registry", () => {
  it("is valid", () => {
    expect(validateRegistry(games)).toEqual([]);
  });

  it("looks games up by slug", () => {
    expect(getGame("sticker-shock")?.name).toBe("Sticker Shock");
    expect(getGame("nope")).toBeUndefined();
  });

  it("keeps hidden games off the shelf", () => {
    const hidden = games.filter((g) => g.status === "hidden").map((g) => g.slug);
    const shelf = shelfGames().map((g) => g.slug);
    expect(shelf.filter((slug) => hidden.includes(slug))).toEqual([]);
    expect(liveGames().every((g) => g.status === "live")).toBe(true);
  });

  it("requires theme, mascot and launch date once a game is live", () => {
    const { theme: _theme, mascot: _mascot, ...bare } = PLACEHOLDER_GAME;
    expect(gameDefinitionSchema.safeParse({ ...bare, status: "live" }).success).toBe(false);
    expect(gameDefinitionSchema.safeParse({ ...PLACEHOLDER_GAME, status: "live" }).success).toBe(
      true,
    );
  });

  it("rejects colours that are not hex", () => {
    const theme = {
      ...PLACEHOLDER_THEME,
      light: { ...PLACEHOLDER_THEME.light, bg: "red;}body{display:none" },
    };
    expect(gameDefinitionSchema.safeParse({ ...PLACEHOLDER_GAME, theme }).success).toBe(false);
  });

  it("makes unreleased games reachable only in development or with ENABLE_DEV_ROUTES", () => {
    const hidden = PLACEHOLDER_GAME;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_DEV_ROUTES", "");
    expect(isGameReachable(hidden)).toBe(false);
    vi.stubEnv("ENABLE_DEV_ROUTES", "1");
    expect(isGameReachable(hidden)).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_ROUTES", "");
    expect(isGameReachable(hidden)).toBe(true);
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  function expectAA(label: string, theme: GameTheme) {
    for (const mode of ["light", "dark"] as const) {
      const ratio = contrastRatio(theme[mode].ink, theme[mode].bg);
      expect(ratio, `${label} ${mode}: ink on bg is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
  }

  it("every live or coming-soon theme reaches AA for ink on bg", () => {
    for (const game of games) {
      if (game.status === "hidden") continue;
      if (!game.theme) throw new Error(`${game.slug} is ${game.status} but has no theme`);
      expectAA(game.slug, game.theme);
    }
  });

  it("the placeholder theme reaches AA", () => {
    expectAA("placeholder", PLACEHOLDER_THEME);
  });

  it("the frame tokens reach AA", () => {
    const css = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
    const blocks = [...css.matchAll(/(:root[^{]*)\{([^}]*)\}/g)];
    const values = (block: string, name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(block)?.[1];
    let checked = 0;
    for (const [, , body] of blocks) {
      const bg = values(body ?? "", "frame-bg");
      if (!bg) continue;
      for (const fg of ["frame-ink", "frame-muted"]) {
        const ink = values(body ?? "", fg);
        if (!ink) throw new Error(`missing --${fg}`);
        expect(contrastRatio(ink, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        checked++;
      }
    }
    expect(checked).toBe(6); // light, dark (media query) and dark (explicit)
  });
});
