"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GameDefinition, GameMode } from "@/games/types";
import { track } from "@/lib/analytics/track";
import { sound } from "@/lib/sound";
import { effectiveStreak, playerStorage } from "@/lib/storage";
import { GameContext, type FrameSheet, type GameContextValue } from "./GameContext";
import { GameThemeStyle } from "./GameThemeStyle";
import { useHistory, useMeta, usePuzzleNumber, useStats, useUnlimited } from "./hooks";
import type { HowToPlayContent } from "./HowToPlaySheet";
import { LazyHowToPlaySheet, LazySettingsSheet, LazyStatsSheet, prefetchWhenIdle } from "./lazy";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";
import { cx } from "./ui/cx";

export interface GameShellProps {
  game: GameDefinition;
  mode: GameMode;
  howTo: HowToPlayContent;
  /** Extra rows for the settings sheet, e.g. display currency. */
  gameSettings?: ReactNode;
  /** Labels scores in the stats chart. */
  formatScore?: (score: number) => string;
  /** Extra classes for the game world, e.g. the display font's next/font variable. */
  className?: string;
  children: ReactNode;
}

/**
 * Wraps every game: the game's --game-* variables, the shared top bar and sheets, the how-to
 * sheet on a first visit, and a context with the puzzle number, player state, sound and analytics.
 */
export function GameShell({
  game,
  mode,
  howTo,
  gameSettings,
  formatScore,
  className,
  children,
}: GameShellProps) {
  const slug = game.slug;
  const puzzle = usePuzzleNumber(mode === "daily" ? game.launchDate : undefined);
  const meta = useMeta();
  const stats = useStats(slug);
  const history = useHistory(slug);
  const unlimited = useUnlimited(slug);
  const [sheet, setSheet] = useState<FrameSheet | null>(null);
  const [howToDismissed, setHowToDismissed] = useState(false);

  // First visit: show how to play once, before anything else.
  const firstVisit = meta !== null && !meta.howToSeen.includes(slug) && !howToDismissed;
  const helpOpen = sheet === "help" || firstVisit;

  useEffect(() => prefetchWhenIdle("howTo", "stats", "settings"), []);

  function closeHelp() {
    setSheet(null);
    setHowToDismissed(true);
    playerStorage().updateMeta((m) =>
      m.howToSeen.includes(slug) ? {} : { howToSeen: [...m.howToSeen, slug] },
    );
  }

  const context = useMemo<GameContextValue>(() => {
    const store = playerStorage();
    const completedToday = puzzle !== null && Boolean(history[String(puzzle)]?.finishedAt);
    return {
      game,
      mode,
      puzzle,
      player: {
        stats,
        history,
        unlimited,
        completedToday,
        streak: puzzle === null ? stats.currentStreak : effectiveStreak(stats, puzzle),
        start() {
          if (mode === "daily" && puzzle !== null) store.recordDailyStart(slug, puzzle);
          track("game_start", { game: slug, mode, puzzle });
        },
        saveProgress(answers) {
          if (mode === "daily" && puzzle !== null) store.saveDailyProgress(slug, puzzle, answers);
        },
        complete({ answers, score }) {
          if (mode === "daily") {
            if (puzzle === null) return;
            store.recordDailyCompletion(slug, puzzle, { answers, score });
          } else {
            store.recordUnlimitedRun(slug, score);
          }
          track("game_complete", { game: slug, mode, puzzle, score });
        },
      },
      playSound: (name) => void sound.play(name),
      track,
      openSheet: setSheet,
    };
  }, [game, mode, puzzle, slug, stats, history, unlimited]);

  return (
    <GameContext.Provider value={context}>
      <GameThemeStyle slug={slug} theme={game.theme} />
      <div
        data-game={slug}
        data-mode={mode}
        className={cx("flex min-h-dvh flex-col bg-game-bg text-game-ink", className)}
      >
        <SkipLink />
        <TopBar
          inGame
          onHelp={() => setSheet("help")}
          onStats={() => setSheet("stats")}
          onSettings={() => setSheet("settings")}
        />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
      {helpOpen && <LazyHowToPlaySheet open onClose={closeHelp} content={howTo} />}
      {sheet === "stats" && (
        <LazyStatsSheet
          open
          onClose={() => setSheet(null)}
          stats={stats}
          unlimited={game.modes.includes("unlimited") ? unlimited : undefined}
          todayPuzzle={puzzle}
          formatScore={formatScore}
        />
      )}
      {sheet === "settings" && (
        <LazySettingsSheet open onClose={() => setSheet(null)} gameSettings={gameSettings} />
      )}
    </GameContext.Provider>
  );
}
