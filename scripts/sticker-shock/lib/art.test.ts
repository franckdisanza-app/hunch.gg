import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { artFiles } from "./art";
import { readWoff, textPath } from "../../lib/font-paths";

const root = process.cwd();
const out = join(root, "public", "games", "sticker-shock");

describe("pnpm sticker-shock:art", () => {
  it("left the committed mascot and wordmark in sync with the drawing code", () => {
    for (const [path, content] of Object.entries(artFiles(root))) {
      expect(readFileSync(join(out, path), "utf8"), `${path}: run pnpm sticker-shock:art`).toBe(
        content,
      );
    }
  });

  it("copied a flag for every country, with the flag-icons licence", () => {
    const countries = JSON.parse(
      readFileSync(join(root, "content", "sticker-shock", "countries.json"), "utf8"),
    ) as { code: string }[];
    for (const { code } of countries) {
      expect(existsSync(join(out, "flags", `${code.toLowerCase()}.svg`)), code).toBe(true);
    }
    expect(readFileSync(join(out, "flags", "LICENSE.txt"), "utf8")).toMatch(/MIT License/);
  });
});

describe("font paths", () => {
  const anton = readWoff(
    readFileSync(
      join(root, "node_modules", "@fontsource", "anton", "files", "anton-latin-400-normal.woff"),
    ),
  );

  it("draws glyph outlines as closed SVG paths", () => {
    const { d, width } = textPath(anton, "SHOCK", 40, 36);
    expect(width).toBeGreaterThan(60);
    expect(d).toMatch(/^M [\d.-]+ [\d.-]+/);
    expect(d.match(/Z/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("gives a space no outline but an advance", () => {
    const space = textPath(anton, " ", 40, 36);
    expect(space.d).toBe("");
    expect(space.width).toBeGreaterThan(0);
  });
});
