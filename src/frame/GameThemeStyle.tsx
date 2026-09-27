import type { GameTheme } from "@/games/types";
import { gameThemeCss } from "./game-theme";

/**
 * Emits a game's scoped --game-* variables. React hoists and dedupes <style> tags that have an
 * href and a precedence, so rendering this in several tiles costs one tag.
 */
export function GameThemeStyle({ slug, theme }: { slug: string; theme: GameTheme | undefined }) {
  if (!theme) return null;
  return (
    <style href={`game-theme-${slug}`} precedence="default">
      {gameThemeCss(slug, theme)}
    </style>
  );
}
