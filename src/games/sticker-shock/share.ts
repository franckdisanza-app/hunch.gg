import { summarize } from "@/engines/choice/summary";
import { formatCurrency } from "@/lib/format";
import type { DailyShareInput, RunShareInput } from "@/lib/share";
import type { DailyPuzzle } from "./content.schema";
import { DISPLAY_CURRENCIES } from "./pricing";
import { displayAmount, roundsFromDaily } from "./rounds";
import { strings } from "./strings";
import { teaser } from "./text";

const SLUG = "sticker-shock";

/** The pair the teaser asks about: a different-item pair, picked by the puzzle number. */
export function teaserPair(day: DailyPuzzle) {
  const different = day.pairs.filter((p) => p.kind === "different");
  const pool = different.length ? different : day.pairs;
  return pool[day.puzzle % pool.length]!;
}

/**
 *   Sticker Shock #42 · 8/10
 *   🟩🟩🟥🟩🟩🟩🟩🟥🟩🟩
 *   Eggs in Japan or bananas in Switzerland?
 *   https://plimp.lol/sticker-shock?ref=share
 */
export function dailyShare(
  day: DailyPuzzle,
  answers: readonly { correct: boolean }[],
): DailyShareInput {
  const summary = summarize(answers);
  const pair = teaserPair(day);
  const rounds = roundsFromDaily(day);
  // The day's prices, in every display currency: none may ever end up in the share text.
  const spoilers = rounds.flatMap((round) =>
    round.options.flatMap((price) =>
      DISPLAY_CURRENCIES.map((c) => formatCurrency(displayAmount(price, c, day.rates), c)),
    ),
  );
  return {
    gameName: strings.name,
    slug: SLUG,
    puzzle: day.puzzle,
    score: { value: summary.score, max: rounds.length },
    grid: summary.grid,
    teaser: teaser(pair.a, pair.b),
    spoilers,
  };
}

/** "Sticker Shock Endless · streak 14" and the link. */
export function endlessShare(streak: number): RunShareInput {
  return {
    gameName: strings.name,
    slug: SLUG,
    run: { mode: strings.endless, result: strings.share.streak(String(streak)) },
  };
}
