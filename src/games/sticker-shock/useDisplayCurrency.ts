"use client";

import { browserLanguages, saveGamePref, useGamePref, type GamePref } from "@/frame/prefs";
import { DISPLAY_CURRENCIES, defaultDisplayCurrency, type DisplayCurrency } from "./pricing";

/** Saved in plimp:v1:meta under prefs, so any later game that shows prices can share it. */
export const CURRENCY_PREF = "currency";

/** The player's display currency: their choice in settings, else the default for their locale. */
const displayCurrency: GamePref<DisplayCurrency> = {
  key: CURRENCY_PREF,
  is: (value): value is DisplayCurrency =>
    typeof value === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(value),
  browserDefault: () => defaultDisplayCurrency(browserLanguages()),
  serverDefault: "USD",
};

export const useDisplayCurrency = () => useGamePref(displayCurrency);
export const saveDisplayCurrency = (currency: DisplayCurrency) =>
  saveGamePref(displayCurrency, currency);
