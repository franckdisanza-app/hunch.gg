"use client";

import { useSyncExternalStore } from "react";
import { unitForLocale, type DistanceUnit } from "@/engines/map/geo";
import { useMeta } from "@/frame/hooks";
import { playerStorage } from "@/lib/storage";
import { UNIT_PREF } from "./config";

const subscribeNever = () => () => {};

function isUnit(value: unknown): value is DistanceUnit {
  return value === "km" || value === "mi";
}

/**
 * Kilometres or miles: the player's choice in settings, else what the browser's locale uses
 * (distances only appear after a pin, so reading the locale cannot break hydration).
 */
export function useDistanceUnit(): DistanceUnit {
  const meta = useMeta();
  const fallback = useSyncExternalStore(
    subscribeNever,
    () => unitForLocale(navigator.languages?.[0] ?? navigator.language),
    () => "km" as const,
  );
  const saved = meta?.prefs[UNIT_PREF];
  return isUnit(saved) ? saved : fallback;
}

/** Saved in plimp:v1:meta prefs, so later map games (Souvenir) share it. */
export function saveDistanceUnit(unit: DistanceUnit) {
  playerStorage().updateMeta((meta) => ({ prefs: { ...meta.prefs, [UNIT_PREF]: unit } }));
}
