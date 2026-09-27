import { PLACEHOLDER_THEME } from "./placeholders";
import { gameThemeCss } from "./game-theme";

describe("gameThemeCss", () => {
  it("scopes light and dark variables to the game", () => {
    const css = gameThemeCss("demo", {
      ...PLACEHOLDER_THEME,
      light: { ...PLACEHOLDER_THEME.light, extras: { paper: "#FFFFFF" } },
    });
    expect(css).toContain('[data-game="demo"]{--game-bg:#F4F1EA;');
    expect(css).toContain("--game-paper:#FFFFFF;");
    expect(css).toContain(':root:not([data-theme="light"]) [data-game="demo"]{--game-bg:#1C1B19;');
    expect(css).toContain(':root[data-theme="dark"] [data-game="demo"]{--game-bg:#1C1B19;');
    expect(css).toContain(':root [data-theme-scope="light"] [data-game="demo"]{--game-bg:#F4F1EA;');
  });
});
