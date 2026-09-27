# Content

One folder per game: `content/<slug>/`. Daily puzzles live in `daily/0001.json`,
`daily/0002.json`, … (puzzle number = days since the game's launch date, plus 1). Other files
(an unlimited-mode pool, `csv-mapping.json`) sit next to them.

- The shape of every file is defined by `src/games/<slug>/content.schema.ts`.
- Every fact carries `sourceTitle`, `sourceUrl`, `checkedOn` (YYYY-MM-DD) and `licence`.
- Placeholder content is marked `"sample": true` and is rejected when `CONTENT_MODE=production`.
- `pnpm content:validate` checks all of this, plus 14 days (error) and 30 days (warning) of
  daily files ahead for live games. It runs in CI and before every build.
- Never import these files from `src/`: the puzzle API reads them at request time, so future
  answers never reach the browser early. ESLint enforces this.
- Spreadsheet exports: `pnpm csv-to-json <game> <file.csv>` with `content/<game>/csv-mapping.json`.
