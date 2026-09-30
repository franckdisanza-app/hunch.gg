"use client";

import { useCallback, useEffect, useState } from "react";
import * as z from "zod/mini";

export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  /** The server answered 404: nothing to serve (yet). */
  | { status: "missing" }
  /** Network or server trouble, or a file that fails its schema. */
  | { status: "error" };

interface Fetched {
  status: number;
  body: unknown;
}

/** A request started early (before React hydrates), for useJson to pick up. */
export interface Prefetched {
  url: string;
  result: Promise<Fetched>;
}

/** Fetches a JSON document; the body is read at once, so the result can be shared. */
export function requestJson(url: string): Promise<Fetched> {
  return fetch(url).then(async (res) => ({
    status: res.status,
    body: res.ok ? ((await res.json()) as unknown) : null,
  }));
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
    const request = attempt === 0 && prefetched?.url === url ? prefetched.result : requestJson(url);
    request
      .then(({ status, body }) => {
        if (status === 404) return done({ status: "missing" });
        if (status < 200 || status >= 300) return done({ status: "error" });
        const parsed = z.safeParse(schema, body);
        done(parsed.success ? { status: "ready", data: parsed.data } : { status: "error" });
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
