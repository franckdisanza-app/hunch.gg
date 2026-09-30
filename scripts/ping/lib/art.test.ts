import { readFileSync } from "node:fs";
import { join } from "node:path";
import { artFiles, relativePath } from "./art";

describe("pnpm ping:art", () => {
  it("left the committed mascot and wordmark in sync with the drawing code", () => {
    const root = process.cwd();
    for (const [path, content] of Object.entries(artFiles(root))) {
      expect(
        readFileSync(join(root, "public", "games", "ping", path), "utf8"),
        `${path}: run pnpm ping:art`,
      ).toBe(content);
    }
  });
});

describe("relativePath", () => {
  /** Reads a path of m/l/z commands back into absolute points, one list per subpath. */
  function absolute(d: string): number[][][] {
    const shapes: number[][][] = [];
    let [x, y] = [0, 0];
    let [startX, startY] = [0, 0];
    for (const [, command, args] of d.matchAll(/([mlz])([^mlz]*)/g)) {
      if (command === "z") {
        [x, y] = [startX, startY];
        continue;
      }
      const values = (args!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      for (let i = 0; i + 1 < values.length; i += 2) {
        [x, y] = [x + values[i]!, y + values[i + 1]!];
        if (command === "m" && i === 0) {
          [startX, startY] = [x, y];
          shapes.push([]);
        }
        shapes.at(-1)!.push([x, y]);
      }
    }
    return shapes;
  }

  it("draws the same points as the absolute path it replaces", () => {
    const d = "M10,20L15,20L15,-5L10,20ZM100,100L90,110L95,95ZM-3,4L3,-4";
    expect(relativePath(d)).toBe("m10 20 5 0 0-25-5 25zm90 80-10 10 5-15zm-103-96 6-8");
    expect(absolute(relativePath(d))).toEqual([
      [
        [10, 20],
        [15, 20],
        [15, -5],
        [10, 20],
      ],
      [
        [100, 100],
        [90, 110],
        [95, 95],
      ],
      [
        [-3, 4],
        [3, -4],
      ],
    ]);
  });
});
