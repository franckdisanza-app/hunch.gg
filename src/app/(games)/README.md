# Game routes

One folder per game, created by `pnpm new-game`: `(games)/<slug>/page.tsx` (daily),
`unlimited/page.tsx`, `opengraph-image.tsx`, and optionally a `layout.tsx` that loads the game's
display fonts with `next/font` (so they load on the game's own routes only).

The `(games)` route group does not appear in URLs: a game lives at `/<slug>`.
