"use client";

import { useSyncExternalStore } from "react";
import { playerStorage } from "@/lib/storage";
import { useMeta } from "./hooks";

// Game preferences (display currency, distance unit, …), saved in plimp:v1:meta under `prefs`.
// Keys are shared on purpose: every game that shows prices reads the same "currency".

/** What meta.prefs can hold. */
type PrefValue = string | number | boolean;

export interface GamePref<T extends PrefValue> {
  /** The key under meta.prefs. */
  key: string;
  /** Whether a stored value is still valid (an old or hand-edited value falls back). */
  is(value: unknown): value is T;
  /** The default in the browser, e.g. from the locale. Only read after hydration. */
  browserDefault(): T;
  /** The default on the server and during hydration. */
  serverDefault: T;
}

const subscribeNever = () => () => {};

/** The player's choice, else the browser default (the server default until hydration). */
export function useGamePref<T extends PrefValue>(pref: GamePref<T>): T {
  const meta = useMeta();
  const fallback = useSyncExternalStore(
    subscribeNever,
    pref.browserDefault,
    () => pref.serverDefault,
  );
  const saved = meta?.prefs[pref.key];
  return pref.is(saved) ? saved : fallback;
}

export function saveGamePref<T extends PrefValue>(pref: GamePref<T>, value: T): void {
  playerStorage().updateMeta((meta) => ({ prefs: { ...meta.prefs, [pref.key]: value } }));
}

/** The browser's preferred languages, most preferred first. */
export function browserLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}
