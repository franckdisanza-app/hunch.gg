"use client";

import type { ReactNode } from "react";
import { GameShell } from "@/frame/GameShell";
import { cx } from "@/frame/ui/cx";
import { getGame } from "@/games/registry";
import type { GameMode } from "@/games/types";
import { formatNumber } from "@/lib/format";
import { HowToDemo } from "./components/HowToDemo";
import styles from "./components/world.module.css";
import { DAILY_MAX } from "./config";
import { mascot } from "./mascot";
import { strings } from "./strings";
import { theme } from "./theme";
import { UnitSetting } from "./UnitSetting";

const game = getGame("ping")!;
// Until the game is live, its registry entry may have no theme or mascot; use the game's own.
const definition = { ...game, theme: game.theme ?? theme, mascot: game.mascot ?? mascot };

/** Daily scores run to 3,000: the stats chart groups them by 500. */
const BUCKET = 500;
const bucket = (score: number) => Math.min(DAILY_MAX - BUCKET, Math.floor(score / BUCKET) * BUCKET);
const bucketLabel = (from: number) =>
  strings.stats.bucket(
    formatNumber(from),
    formatNumber(from + BUCKET >= DAILY_MAX ? DAILY_MAX : from + BUCKET - 1),
  );

/**
 * The frame around Ping: theme, fonts (`fontClassName` holds the route's next/font variables),
 * how to play with its looping demo, the distance unit setting and stats in buckets of 500.
 */
export function PingShell({
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
      gameSettings={<UnitSetting />}
      formatScore={bucketLabel}
      scoreBucket={bucket}
      unlimitedLabel={strings.unlimited}
      className={cx(fontClassName, styles.world)}
    >
      {children}
    </GameShell>
  );
}
