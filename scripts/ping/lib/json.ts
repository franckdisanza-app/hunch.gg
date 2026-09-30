import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as prettier from "prettier";

// Generated content goes through Prettier, so `pnpm lint` (prettier --check) stays green: plain
// JSON.stringify spreads short arrays such as bounding boxes over several lines, Prettier does not.

export async function formatJson(file: string, data: unknown): Promise<string> {
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(JSON.stringify(data), { ...config, parser: "json", filepath: file });
}

/** Writes `data` as formatted JSON; returns false when the file already held exactly that. */
export async function writeJson(file: string, data: unknown): Promise<boolean> {
  const text = await formatJson(file, data);
  if (existsSync(file) && readFileSync(file, "utf8") === text) return false;
  writeFileSync(file, text);
  return true;
}
