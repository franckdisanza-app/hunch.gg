"use client";

import { unitForLocale, type DistanceUnit } from "@/engines/map/geo";
import { browserLanguages, saveGamePref, useGamePref, type GamePref } from "@/frame/prefs";
import { UNIT_PREF } from "./config";

/**
 * Kilometres or miles: the player's choice in settings, else what the browser's locale uses
 * (distances only appear after a pin, so reading the locale cannot break hydration). Later map
 * games (Souvenir) share the key.
 */
const distanceUnit: GamePref<DistanceUnit> = {
  key: UNIT_PREF,
  is: (value): value is DistanceUnit => value === "km" || value === "mi",
  browserDefault: () => unitForLocale(browserLanguages()[0]),
  serverDefault: "km",
};

export const useDistanceUnit = () => useGamePref(distanceUnit);
export const saveDistanceUnit = (unit: DistanceUnit) => saveGamePref(distanceUnit, unit);
