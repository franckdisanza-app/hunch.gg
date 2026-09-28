"use client";

import { useMemo, useSyncExternalStore } from "react";
import { deviceTimeZone, msUntilNextPuzzle, puzzleNumber } from "@/lib/daily";
import {
  EMPTY_HISTORY,
  EMPTY_POLL_VOTES,
  EMPTY_STATS,
  EMPTY_UNLIMITED,
  playerStorage,
  type PlayerStorage,
} from "@/lib/storage";

// React bindings for player storage and the clock. Static pages render with the server snapshot
// (defaults); the real values appear right after hydration.

function useStore<T>(select: (store: PlayerStorage) => T, serverValue: T): T {
  return useSyncExternalStore(
    (onChange) => playerStorage().subscribe(onChange),
    () => select(playerStorage()),
    () => serverValue,
  );
}

/** Null before hydration or before FrameProviders has created it. */
export const useMeta = () => useStore((s) => s.peekMeta(), null);
export const useStats = (game: string) => useStore((s) => s.getStats(game), EMPTY_STATS);
export const useHistory = (game: string) => useStore((s) => s.getHistory(game), EMPTY_HISTORY);
export const useUnlimited = (game: string) =>
  useStore((s) => s.getUnlimited(game), EMPTY_UNLIMITED);
export const usePollVotes = (game: string) =>
  useStore((s) => s.getPollVotes(game), EMPTY_POLL_VOTES);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * Whether the player asked for reduced motion. Server renders and the first client render assume
 * yes, so nothing animates before we know.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => true,
  );
}

/** True once the component is running in the browser (false on the server and during hydration). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** The current time, rounded down to `granularityMs`; null on the server. */
export function useNow(granularityMs = 1000): number | null {
  const subscribe = useMemo(
    () => (onChange: () => void) => {
      const id = window.setInterval(onChange, Math.min(granularityMs, 1000));
      return () => window.clearInterval(id);
    },
    [granularityMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / granularityMs) * granularityMs,
    () => null,
  );
}

function subscribeToNextPuzzle(onChange: () => void) {
  let timer = 0;
  const schedule = () => {
    window.clearTimeout(timer);
    const wait = msUntilNextPuzzle(Date.now(), deviceTimeZone()) + 50;
    timer = window.setTimeout(
      () => {
        onChange();
        schedule();
      },
      Math.min(wait, 2 ** 31 - 1),
    );
  };
  // Timers pause in background tabs; re-check when the tab comes back.
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      onChange();
      schedule();
    }
  };
  schedule();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/**
 * Today's puzzle number in the player's own time zone, updating at local midnight.
 * Null on the server, and when the game has no launch date yet.
 */
export function usePuzzleNumber(launchDate: string | undefined): number | null {
  return useSyncExternalStore(
    subscribeToNextPuzzle,
    () => (launchDate ? puzzleNumber(launchDate, Date.now(), deviceTimeZone()) : null),
    () => null,
  );
}
