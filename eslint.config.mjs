import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Shared files in src/games that anyone may import.
const SHARED_GAME_FILES = ["./types.ts", "./registry.ts", "./content.ts"];

const gameSlugs = readdirSync(new URL("./src/games", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// Games are plugins: a game may import the frame, engines and lib, never another game.
const gameIsolationZones = gameSlugs.flatMap((slug) => [
  {
    target: `./src/games/${slug}`,
    from: "./src/games",
    except: [`./${slug}`, ...SHARED_GAME_FILES],
  },
  {
    target: `./src/app/(games)/${slug}`,
    from: "./src/games",
    except: [`./${slug}`, ...SHARED_GAME_FILES],
  },
]);

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // eslint-plugin-react cannot auto-detect the React version under ESLint 10.
    settings: { react: { version: "19.3" } },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            ...gameIsolationZones,
            {
              target: "./src/frame",
              from: "./src/games",
              except: SHARED_GAME_FILES,
              message: "The frame is shared by every game and must not import game code.",
            },
            {
              target: "./src",
              from: "./content",
              message:
                "Content is read at request time by the puzzle API. Importing it would bundle future answers.",
            },
          ],
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
