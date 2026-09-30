import type { ShareMethod } from "./analytics/events";
import { SHARE_REF } from "./analytics/share-arrival";
import { formatNumber } from "./format";
import { siteUrl } from "./site";

// The share text format is shared by every game (the share image is each game's own):
//   <Game> #<n> · <score>
//   <emoji grid>
//   <one teaser question>
//   <link>?ref=share
// An unlimited run shares one line and the link:
//   <Game> <mode> · <result>        e.g. "Sticker Shock Endless · streak 14"
// No spoilers: a share never contains the day's answers. The score is always written in numbers.

export interface ShareScore {
  value: number;
  /** When set, the score reads "value/max". */
  max?: number;
}

export interface DailyShareInput {
  gameName: string;
  slug: string;
  puzzle: number;
  score: ShareScore;
  /** One line of emoji, e.g. "🟩🟥🟩🟩🟨". */
  grid: string;
  /** One question that makes people curious without giving anything away. */
  teaser: string;
  /** The day's answers. Any line that contains one is dropped (and throws outside production). */
  spoilers?: readonly string[];
  /** Base URL; defaults to NEXT_PUBLIC_SITE_URL. */
  baseUrl?: string;
}

/** An unlimited run: no puzzle number, no grid, no teaser. */
export interface RunShareInput {
  gameName: string;
  slug: string;
  run: {
    /** The game's name for its unlimited mode, e.g. "Endless". */
    mode: string;
    /** The result, e.g. "streak 14". Always numbers. */
    result: string;
  };
  baseUrl?: string;
}

export type ShareInput = DailyShareInput | RunShareInput;

export class SpoilerError extends Error {}

/** "8/10", "812", "2,140/3,000": numbers in the UI locale, never words. */
export function formatShareScore(score: ShareScore): string {
  const value = formatNumber(score.value);
  return score.max === undefined ? value : `${value}/${formatNumber(score.max)}`;
}

export function shareUrl(slug: string, baseUrl = siteUrl()): string {
  const url = new URL(`/${slug}`, `${baseUrl}/`);
  url.searchParams.set("ref", SHARE_REF);
  return url.toString();
}

function containsSpoiler(line: string, spoilers: readonly string[]): string | undefined {
  const haystack = line.toLocaleLowerCase();
  return spoilers
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .find((s) => haystack.includes(s.toLocaleLowerCase()));
}

export function buildShareText(input: ShareInput): string {
  if ("run" in input) {
    const header = `${input.gameName} ${input.run.mode} · ${input.run.result}`;
    return [header, shareUrl(input.slug, input.baseUrl)].join("\n");
  }
  const header = `${input.gameName} #${input.puzzle} · ${formatShareScore(input.score)}`;
  const link = shareUrl(input.slug, input.baseUrl);
  const body = [input.grid, input.teaser].map((line) => line.trim()).filter(Boolean);

  const spoilers = input.spoilers ?? [];
  const safeBody = body.filter((line) => {
    const hit = containsSpoiler(line, spoilers);
    if (hit && process.env.NODE_ENV !== "production") {
      throw new SpoilerError(`Share text would reveal an answer ("${hit}") in: ${line}`);
    }
    return !hit;
  });

  return [header, ...safeBody, link].join("\n");
}

export type ShareOutcome = ShareMethod | "cancelled" | "failed";

/** Web Share API when available, otherwise the clipboard. */
export async function shareText(text: string): Promise<ShareOutcome> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (nav && typeof nav.share === "function" && (!nav.canShare || nav.canShare({ text }))) {
    try {
      await nav.share({ text });
      return "native";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Otherwise fall back to the clipboard.
    }
  }
  try {
    await nav?.clipboard.writeText(text);
    return nav?.clipboard ? "clipboard" : "failed";
  } catch {
    return "failed";
  }
}
