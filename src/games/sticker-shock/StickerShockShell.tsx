"use client";

import type { ReactNode } from "react";
import { GameShell } from "@/frame/GameShell";
import { cx } from "@/frame/ui/cx";
import { getGame } from "@/games/registry";
import type { GameMode } from "@/games/types";
import { HowToDemo } from "./components/HowToDemo";
import styles from "./components/world.module.css";
import { CurrencySetting } from "./CurrencySetting";
import { mascot } from "./mascot";
import { strings } from "./strings";
import { theme } from "./theme";

const game = getGame("sticker-shock")!;
// Until the game is live, its registry entry may have no theme or mascot; use the game's own.
const definition = { ...game, theme: game.theme ?? theme, mascot: game.mascot ?? mascot };

/**
 * The frame around Sticker Shock: theme, fonts (`fontClassName` holds the route's next/font
 * variables), how to play with its demo, the display currency setting and stats labels.
 */
export function StickerShockShell({
  mode,
  fontClassName,
  children,
}: {
  mode: GameMode;
  fontClassName: string;
  children: ReactNode;
}) {
  return (
    <GameShell
      game={definition}
      mode={mode}
      howTo={{ lines: strings.howTo.lines, example: <HowToDemo className={fontClassName} /> }}
      gameSettings={<CurrencySetting />}
      formatScore={(score) => `${score}/10`}
      unlimitedLabel={strings.endless}
      className={cx(fontClassName, styles.world)}
    >
      {children}
    </GameShell>
  );
}
