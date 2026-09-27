import type { GameTheme, ThemeTokens } from "@/games/types";

// Turns a game's theme into scoped CSS variables. The result is rendered in a <style> tag by
// GameShell (and by shelf tiles), so light/dark switching stays pure CSS with no flash. Colours
// are validated as hex by the registry schema before they ever reach this function.

function declarations(tokens: ThemeTokens): string {
  const vars: [string, string][] = [
    ["--game-bg", tokens.bg],
    ["--game-ink", tokens.ink],
    ["--game-accent-1", tokens.accent1],
    ["--game-accent-2", tokens.accent2],
    ["--game-accent-3", tokens.accent3],
    ...Object.entries(tokens.extras ?? {}).map(
      ([name, value]) => [`--game-${name}`, value] as [string, string],
    ),
  ];
  return vars.map(([name, value]) => `${name}:${value};`).join("");
}

export function gameSelector(slug: string): string {
  return `[data-game="${slug}"]`;
}

export function gameThemeCss(slug: string, theme: GameTheme): string {
  const scope = gameSelector(slug);
  const light = declarations(theme.light);
  const dark = declarations(theme.dark);
  return [
    `${scope}{${light}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) ${scope}{${dark}}}`,
    `:root[data-theme="dark"] ${scope}{${dark}}`,
  ].join("\n");
}
