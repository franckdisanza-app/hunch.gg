"use client";

import dynamic from "next/dynamic";

// Sheets and dialogs that are not needed for the first paint. They load when first opened (and
// are prefetched when the browser is idle), which keeps them out of every page's first-load
// JavaScript. Render them only while open.

const load = {
  howTo: () => import("./HowToPlaySheet"),
  stats: () => import("./StatsSheet"),
  settings: () => import("./SettingsSheet"),
  report: () => import("./ReportDialog"),
  playedToday: () => import("./PlayedTodayBadge"),
};

export const LazyHowToPlaySheet = dynamic(() => load.howTo().then((m) => m.HowToPlaySheet), {
  ssr: false,
});
export const LazyStatsSheet = dynamic(() => load.stats().then((m) => m.StatsSheet), {
  ssr: false,
});
export const LazySettingsSheet = dynamic(() => load.settings().then((m) => m.SettingsSheet), {
  ssr: false,
});
export const LazyReportDialog = dynamic(() => load.report().then((m) => m.ReportDialog), {
  ssr: false,
});

// Not a sheet, but the same idea: the shelf's "played today" badge needs player storage (and Zod),
// which the shelf itself does not. It can only show after hydration anyway.
export const LazyPlayedTodayBadge = dynamic(
  () => load.playedToday().then((m) => m.PlayedTodayBadge),
  { ssr: false },
);

/** Fetches the given sheets once the browser is idle, so opening them feels instant. */
export function prefetchWhenIdle(...names: (keyof typeof load)[]): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => names.forEach((name) => void load[name]().catch(() => {}));
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(run, 2000);
  return () => globalThis.clearTimeout(id);
}
