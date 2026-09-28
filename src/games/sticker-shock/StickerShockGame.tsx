"use client";

import { useGame } from "@/frame/GameContext";
import { strings } from "./strings";

// Placeholder: the real game, built on the choice engine (src/engines/choice), replaces it.
export function StickerShockGame() {
  const { mode, puzzle } = useGame();
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="font-display text-3xl font-black">{strings.name}</h1>
      <p className="opacity-80">{strings.placeholder}</p>
      <p className="text-sm tabular opacity-60">
        {mode}
        {puzzle !== null ? ` #${puzzle}` : ""}
      </p>
    </div>
  );
}
