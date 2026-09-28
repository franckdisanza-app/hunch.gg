"use client";

import { useSyncExternalStore } from "react";
import { useMeta } from "@/frame/hooks";
import { playerStorage } from "@/lib/storage";
import { DISPLAY_CURRENCIES, defaultDisplayCurrency, type DisplayCurrency } from "./pricing";

/** Saved in plimp:v1:meta under prefs, so any later game that shows prices can share it. */
export const CURRENCY_PREF = "currency";

function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

const subscribeNever = () => () => {};

function browserLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** The player's display currency: their choice in settings, else the default for their locale. */
export function useDisplayCurrency(): DisplayCurrency {
  const meta = useMeta();
  const fallback = useSyncExternalStore(
    subscribeNever,
    () => defaultDisplayCurrency(browserLanguages()),
    () => "USD" as const,
  );
  const saved = meta?.prefs[CURRENCY_PREF];
  return isDisplayCurrency(saved) ? saved : fallback;
}

export function saveDisplayCurrency(currency: DisplayCurrency) {
  playerStorage().updateMeta((meta) => ({ prefs: { ...meta.prefs, [CURRENCY_PREF]: currency } }));
}
