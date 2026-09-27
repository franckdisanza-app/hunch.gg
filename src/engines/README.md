# Engines

Reusable game mechanics, shared by several games: `choice`, `estimate`, `clue` and `map`. Each
engine arrives with the first game that needs it (the choice engine with Sticker Shock) and is
built to be themed, never to look like any one game.

An engine owns rules and state (rounds, answers, scoring); a game owns content, art, strings,
sounds and the reveal. Engines never import from `src/games/<slug>/`.
