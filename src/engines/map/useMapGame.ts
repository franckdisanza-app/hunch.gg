"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/frame/hooks";
import type { GeoPoint } from "./geo";
import {
  dropPin,
  nextRound,
  saveMap,
  startMap,
  type MapAnswer,
  type MapConfig,
  type MapPin,
  type MapRound,
  type MapState,
  type SavedMapAnswer,
} from "./state";

export interface UseMapGameOptions<R extends MapRound, Band extends string> {
  /** Keep it stable (useMemo). Remount the component with a `key` to start over. */
  config: MapConfig<R, Band>;
  /** Saved pins to resume a daily. */
  restore?: readonly SavedMapAnswer[];
  /** Every pin, as it lands (a ring, a sound, saving progress). */
  onPin?(pin: MapPin<Band>, round: R, state: MapState<R, Band>): void;
  /** The round is over: solved, or out of pins. */
  onReveal?(round: R, answer: MapAnswer<Band>, state: MapState<R, Band>): void;
  /** No more rounds. */
  onFinish?(state: MapState<R, Band>): void;
}

export interface MapGame<R extends MapRound, Band extends string> {
  state: MapState<R, Band>;
  reducedMotion: boolean;
  /** Drops a pin at a point (usually the point under the crosshair). */
  drop(point: GeoPoint): void;
  next(): void;
  /** What to save to resume later: finished rounds and the current round's pins. */
  saved(): SavedMapAnswer[];
  /** Callback ref for the Next button: it receives focus after each reveal. */
  setNextButton(element: HTMLButtonElement | null): void;
  /** Callback ref for what gets focus on a new round (the globe). */
  setAimElement(element: { focus(): void } | null): void;
}

/**
 * React binding for the map engine: state, callbacks and focus. The globe, the buttons and the
 * reveal are the game's; this hook owns behaviour only.
 */
export function useMapGame<R extends MapRound, Band extends string>(
  options: UseMapGameOptions<R, Band>,
): MapGame<R, Band> {
  const { config, restore } = options;
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState(() => startMap(config, restore));

  // Latest values for handlers; handlers also write the state they produce, so a second tap
  // before React re-renders sees it.
  const latest = useRef({ state, options });
  useLayoutEffect(() => {
    latest.current = { state, options };
  });

  const nextElement = useRef<HTMLButtonElement | null>(null);
  const aimElement = useRef<{ focus(): void } | null>(null);
  // Focus only moves after the player did something, never on page load.
  const interacted = useRef(false);

  const commit = useCallback((updated: MapState<R, Band>) => {
    latest.current = { ...latest.current, state: updated };
    setState(updated);
  }, []);

  const drop = useCallback(
    (point: GeoPoint) => {
      const { state: current, options: opts } = latest.current;
      const updated = dropPin(current, opts.config, point);
      if (updated === current || !updated.round) return;
      interacted.current = true;
      commit(updated);
      const pin = updated.pins.at(-1)!;
      opts.onPin?.(pin, updated.round, updated);
      if (updated.phase === "revealed" && updated.answer) {
        opts.onReveal?.(updated.round, updated.answer, updated);
      }
    },
    [commit],
  );

  const next = useCallback(() => {
    const { state: current, options: opts } = latest.current;
    if (current.phase !== "revealed") return;
    interacted.current = true;
    const updated = nextRound(current, opts.config);
    commit(updated);
    if (updated.phase === "finished") opts.onFinish?.(updated);
  }, [commit]);

  const saved = useCallback(() => saveMap(latest.current.state), []);

  // Focus: Next after a reveal, the globe on a new round.
  useEffect(() => {
    if (!interacted.current) return;
    if (state.phase === "revealed") nextElement.current?.focus({ preventScroll: true });
    else if (state.phase === "aiming") aimElement.current?.focus();
  }, [state.phase, state.index]);

  const setNextButton = useCallback((element: HTMLButtonElement | null) => {
    nextElement.current = element;
  }, []);
  const setAimElement = useCallback((element: { focus(): void } | null) => {
    aimElement.current = element;
  }, []);

  return { state, reducedMotion, drop, next, saved, setNextButton, setAimElement };
}
