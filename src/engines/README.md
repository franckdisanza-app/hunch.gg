# Engines

Reusable game mechanics, shared by several games: `choice`, `estimate`, `clue` and `map`. Each
engine arrives with the first game that needs it (the choice engine with Sticker Shock) and is
built to be themed, never to look like any one game.

An engine owns rules and state (rounds, answers, scoring); a game owns content, art, strings,
sounds and the reveal. Engines never import from `src/games/<slug>/`.

## choice

"Which one?" games: Sticker Shock, and later Tiptoe, Coined and Chimp.

- `state.ts`: pure rules. A round has 2 or 3 options and the game supplies `correctIndex`. Daily
  mode plays a fixed `list`; unlimited mode asks a `generator` for the next round and can end on
  the first miss (`endOnMiss`). `startChoice` can resume saved answers (`{ roundId, picked }`).
- `useChoiceGame`: the React binding. Keyboard (A/← and B/→ pick, C for a third option, Enter for
  Next), focus (Next after a reveal, the round after moving on), animation hooks (`onPick`,
  `onReveal`, `onFinish`, `revealDelayMs`, which is 0 under reduced motion). Remount it with a
  `key` to restart.
- `ChoiceBoard`: the default markup. Options are real buttons with `aria-keyshortcuts`; the game
  draws them through `renderOption` (with a status: idle, pending, right, wrong, answer, other) and
  the reveal through `renderReveal`; `announce` fills a polite live region.
- `summary.ts`: score, streaks and the emoji grid for stats and the share text.

No strings live in the engine: every label comes from the game.
