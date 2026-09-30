import { readFileSync } from "node:fs";
import { join } from "node:path";
import { artFiles } from "./art";

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
