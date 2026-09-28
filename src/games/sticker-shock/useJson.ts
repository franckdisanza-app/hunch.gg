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

/**
 * Fetches and validates a JSON document once per URL (null: wait). Crowd calls never go through
 * here; this is only for what the game needs to play.
 */
export function useJson<T>(
  url: string | null,
  schema: z.ZodMiniType<T>,
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
    fetch(url)
      .then(async (res) => {
        if (res.status === 404) return done({ status: "missing" });
        if (!res.ok) return done({ status: "error" });
        const parsed = z.safeParse(schema, await res.json());
        done(parsed.success ? { status: "ready", data: parsed.data } : { status: "error" });
      })
      .catch(() => done({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [url, schema, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loaded: { status: "loading" } }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state.loaded, retry };
}
