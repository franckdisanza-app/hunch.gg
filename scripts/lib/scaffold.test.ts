import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pascalCase, scaffoldGame } from "./scaffold";

// Scaffolds into a temporary copy of the registry. CI also scaffolds a game into the real tree and
// typechecks and lints it (see .github/workflows/ci.yml), which is what proves the templates build.

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "plimp-scaffold-"));
  mkdirSync(join(root, "src", "games"), { recursive: true });
  copyFileSync(
    join(process.cwd(), "src", "games", "registry.ts"),
    join(root, "src", "games", "registry.ts"),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const registry = () => readFileSync(join(root, "src", "games", "registry.ts"), "utf8");

describe("scaffoldGame", () => {
  it("adds a hidden registry entry and every file", async () => {
    const result = await scaffoldGame({
      root,
      slug: "fake-game",
      name: "Fake Game",
      engine: "clue",
    });
    expect(result.registry).toBe("inserted");
    expect(registry()).toMatch(/slug: "fake-game",\s+name: "Fake Game",[\s\S]+?status: "hidden"/);
    expect(registry().indexOf('slug: "fake-game"')).toBeLessThan(
      registry().indexOf("@new-game:entries"),
    );
    for (const file of [
      "src/games/fake-game/strings.ts",
      "src/games/fake-game/theme.ts",
      "src/games/fake-game/mascot.ts",
      "src/games/fake-game/content.schema.ts",
      "src/games/fake-game/FakeGameGame.tsx",
      "src/app/(games)/fake-game/page.tsx",
      "src/app/(games)/fake-game/unlimited/page.tsx",
      "src/app/(games)/fake-game/opengraph-image.tsx",
      "content/fake-game/daily/.gitkeep",
      "docs/games/fake-game.md",
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it("keeps an existing planned entry", async () => {
    const before = registry();
    const result = await scaffoldGame({
      root,
      slug: "sticker-shock",
      name: "Sticker Shock",
      engine: "choice",
    });
    expect(result.registry).toBe("kept");
    expect(registry()).toBe(before);
  });

  it("never overwrites files", async () => {
    await scaffoldGame({ root, slug: "fake-game", name: "Fake Game", engine: "clue" });
    await expect(
      scaffoldGame({ root, slug: "fake-game", name: "Fake Game", engine: "clue" }),
    ).rejects.toThrow(/Refusing to overwrite/);
  });

  it("validates its input", async () => {
    await expect(
      scaffoldGame({ root, slug: "Bad Slug", name: "X", engine: "clue" }),
    ).rejects.toThrow();
    await expect(scaffoldGame({ root, slug: "ok", name: "X", engine: "arcade" })).rejects.toThrow(
      /--engine/,
    );
    await expect(scaffoldGame({ root, slug: "ok", name: " ", engine: "clue" })).rejects.toThrow(
      /--name/,
    );
  });
});

describe("pascalCase", () => {
  it("turns slugs into component names", () => {
    expect(pascalCase("sticker-shock")).toBe("StickerShock");
    expect(pascalCase("ja-nein")).toBe("JaNein");
  });
});
