"use client";

import { createContext, useContext } from "react";
import type { GameDefinition, GameMode } from "@/games/types";
import type { track } from "@/lib/analytics/track";
import type { History, Stats, Unlimited } from "@/lib/storage";

export type FrameSheet = "help" | "stats" | "settings";

export interface GameContextValue {
  game: GameDefinition;
  mode: GameMode;
  /** Today's puzzle number in the player's time zone; null in unlimited mode and before hydration. */
  puzzle: number | null;
  player: {
    stats: Stats;
    history: History;
    unlimited: Unlimited;
    /** The streak as it stands today (0 once a day was missed). */
    streak: number;
    completedToday: boolean;
    /** Call when play begins. Daily: counts the puzzle as played. */
    start(): void;
    /** Daily only: saves answers so a reload can resume. */
    saveProgress(answers: unknown[]): void;
    /** Daily: records the result and streak. Unlimited: records the run. */
    complete(result: { answers: unknown[]; score: number }): void;
  };
  /** Plays a sound registered with lib/sound (only if the player turned sound on). */
  playSound(name: string): void;
  track: typeof track;
  openSheet(sheet: FrameSheet): void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame() must be used inside <GameShell>.");
  return value;
}
