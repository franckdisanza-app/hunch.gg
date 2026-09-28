"use client";

import { GameShell } from "@/frame/GameShell";
import { PLACEHOLDER_GAME } from "@/frame/placeholders";

export function EmptyGameShell() {
  return (
    <GameShell
      game={PLACEHOLDER_GAME}
      mode="daily"
      howTo={{
        lines: ["Placeholder line one.", "Placeholder line two.", "Placeholder line three."],
      }}
    >
      <p className="text-center font-display text-2xl">An empty game world.</p>
    </GameShell>
  );
}
