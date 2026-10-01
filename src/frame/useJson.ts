"use client";

import { useCallback, useEffect, useState } from "react";
import type * as z from "zod/mini";
import { getGame } from "@/games/registry";
import { deviceTimeZone, puzzleNumber } from "@/lib/daily";

// How games load what they need to play (a day's puzzle, an unlimited pool): fetched once per URL,
// validated with the game's schema, retryable. Crowd calls never go through here.

export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  /** The server answered 404: nothing to serve (yet). */
  | { status: "missing" }
  /** Network or server trouble, or a file that fails its schema. */
  | { status: "error" };

interface Fetched {
  /** The HTTP status, or 0 when the request or its body failed (offline, bad JSON). */
  status: number;
  body: unknown;
}

/** A request started early (before React hydrates), for useJson to pick up. */
export interface Prefetched {
  url: string;
  result: Promise<Fetched>;
}

/**
 * Fetches a JSON document; the body is read at once, so the result can be shared. Never rejects,
 * so a prefetch nobody picks up cannot become an unhandled rejection.
 */
export function requestJson(url: string): Promise<Fetched> {
  return fetch(url)
    .then(async (res) => ({
      status: res.status,
      body: res.ok ? ((await res.json()) as unknown) : null,
    }))
    .catch(() => ({ status: 0, body: null }));
}

/**
 * Starts fetching `url` as soon as the calling module runs in the browser (null on the server).
 * Call it at module level, so the request does not wait for React to hydrate.
 */
export function prefetchJson(url: string): Prefetched | null {
  return typeof window === "undefined" ? null : { url, result: requestJson(url) };
}

/** The puzzle API's URL for puzzle `n` of a game. */
export function puzzleUrl(slug: string, n: number): string {
  return `/api/puzzle/${slug}/${n}`;
}

/**
 * Today's puzzle for `slug`, requested before React hydrates: the puzzle is the largest thing on a
 * game page, so it should not wait. Same puzzle number as GameShell's (local date); if they ever
 * differ, useJson simply fetches anew.
 */
export function prefetchTodaysPuzzle(slug: string): Prefetched | null {
  const launchDate = getGame(slug)?.launchDate;
  if (typeof window === "undefined" || !launchDate) return null;
  const n = puzzleNumber(launchDate, Date.now(), deviceTimeZone());
  return n < 1 ? null : prefetchJson(puzzleUrl(slug, n));
}

/**
 * Fetches and validates a JSON document once per URL (null: wait). `prefetched` is used instead
 * of a new request when it is for the same URL (the first time only; a retry fetches again).
 */
export function useJson<T>(
  url: string | null,
  schema: z.ZodMiniType<T>,
  prefetched?: Prefetched | null,
): Loaded<T> & { retry(): void } {
  const [state, setState] = useState<{ url: string | null; loaded: Loaded<T> }>({
    url,
    loaded: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);

  // A new URL starts over (the stored-from-previous-render pattern, no effect needed).
  if (state.url !== url) setState({ url, loaded: { status: "loading" } });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const done = (loaded: Loaded<T>) => {
      if (!cancelled) setState({ url, loaded });
    };
    // An early request that failed on the network (it ran before hydration, maybe on a flaky
    // connection) gets one fresh attempt before the player sees an error.
    const request =
      attempt === 0 && prefetched?.url === url
        ? prefetched.result.then((early) => (early.status === 0 ? requestJson(url) : early))
        : requestJson(url);
    request
      .then(({ status, body }) => {
        if (status === 404) return done({ status: "missing" });
        if (status < 200 || status >= 300) return done({ status: "error" });
        // Standard Schema validation: the same check as z.safeParse, without a runtime Zod import
        // here (which would change how the bundler splits Zod for every game page).
        const parsed = schema["~standard"].validate(body);
        if (parsed instanceof Promise) return done({ status: "error" });
        done(parsed.issues ? { status: "error" } : { status: "ready", data: parsed.value as T });
      })
      .catch(() => done({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [url, schema, attempt, prefetched]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loaded: { status: "loading" } }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state.loaded, retry };
}
