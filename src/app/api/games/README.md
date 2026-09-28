# Game-specific API routes

A game that needs its own endpoints puts them under `src/app/api/games/<slug>/`, for example
`src/app/api/games/sticker-shock/rates/route.ts`. Never add game-specific logic to the shared
routes in `src/app/api/` (puzzle, vote, guess, report, results, crowd, health, cron).
