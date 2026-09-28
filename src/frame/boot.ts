import { getGame } from "@/games/registry";
import type { AnalyticsProviderName } from "@/lib/analytics/config";
import { dueReturnDays } from "@/lib/analytics/return-day";
import { parseShareArrival } from "@/lib/analytics/share-arrival";
import { setAnalyticsProvider, track } from "@/lib/analytics/track";
import { deviceTimeZone, localIsoDate } from "@/lib/daily";
import { sound } from "@/lib/sound";
import { playerStorage } from "@/lib/storage";
import { applyTheme } from "./theme";

/**
 * Client-side boot for every page, loaded right after hydration (see FrameProviders): creates the
 * player's meta on the first visit, syncs theme and sound with it, picks the analytics provider,
 * and reports share arrivals and return days. Returns a cleanup function.
 */
export function boot(analyticsProvider: AnalyticsProviderName): () => void {
  const store = playerStorage();
  const meta = store.getMeta();
  applyTheme(meta.theme);
  sound.setEnabled(meta.sound);

  // Audio stays locked until the first user gesture.
  const unlock = () => sound.unlock();
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });

  setAnalyticsProvider(analyticsProvider);

  const arrival = parseShareArrival(window.location.href, (slug) => Boolean(getGame(slug)));
  if (arrival) {
    track("share_arrival", { game: arrival.game });
    window.history.replaceState(window.history.state, "", arrival.cleanUrl);
  }

  const due = dueReturnDays(
    meta.firstVisit,
    localIsoDate(Date.now(), deviceTimeZone()),
    meta.returnMilestones,
  );
  if (due.length > 0) {
    for (const day of due) track("return_day", { day });
    store.updateMeta((m) => ({ returnMilestones: [...m.returnMilestones, ...due] }));
  }

  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
  };
}
