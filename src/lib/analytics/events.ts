import type { GameMode } from "@/games/types";

// Every analytics event Plimp sends. Props are short identifiers and numbers only: never the
// device ID, never free text. track() enforces this at runtime too.

export type ShareMethod = "native" | "clipboard";
export type ReturnDay = 1 | 7 | 30;

export interface AnalyticsEvents {
  game_start: { game: string; mode: GameMode; puzzle: number | null };
  game_complete: { game: string; mode: GameMode; puzzle: number | null; score: number };
  share_click: { game: string; method: ShareMethod };
  share_arrival: { game: string };
  return_day: { day: ReturnDay };
  poll_vote: { poll: string };
  report_sent: { game: string; item: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

export const RETURN_DAYS: readonly ReturnDay[] = [1, 7, 30];
