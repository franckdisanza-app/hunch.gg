"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/frame/hooks";
import { OPTION_KEYS, keyToAction, shouldIgnoreKeyTarget } from "./keyboard";
import {
  nextRound,
  pickOption,
  startChoice,
  type ChoiceAnswer,
  type ChoiceConfig,
  type ChoiceRound,
  type ChoiceState,
  type SavedChoiceAnswer,
} from "./state";

export interface UseChoiceGameOptions<R extends ChoiceRound> {
  /** Keep it stable (useMemo). Remount the component with a `key` to start over. */
  config: ChoiceConfig<R>;
  /** Saved answers to resume a daily list. */
  restore?: readonly SavedChoiceAnswer[];
  /**
   * Time between the pick and the reveal, for the game's pick animation. Always 0 when the player
   * prefers reduced motion.
   */
  revealDelayMs?: number;
  /** Listen for A/B/C, ←/→ and Enter on the window. Default true. */
  keyboard?: boolean;
  /** The pick, before the reveal (e.g. a scanner beep). */
  onPick?(round: R, index: number): void;
  /** The answer is revealed (e.g. a right or wrong sound, a crowd guess, saving progress). */
  onReveal?(round: R, answer: ChoiceAnswer, state: ChoiceState<R>): void;
  /** No more rounds. */
  onFinish?(state: ChoiceState<R>): void;
}

export interface ChoiceOptionProps {
  type: "button";
  onClick: () => void;
  disabled: boolean;
  "aria-keyshortcuts": string;
  "data-option": number;
}

export interface ChoiceGame<R extends ChoiceRound> {
  state: ChoiceState<R>;
  /** The option picked and waiting for its reveal, during revealDelayMs. */
  pending: number | null;
  reducedMotion: boolean;
  pick(index: number): void;
  next(): void;
  /** Props for the button of option `index`. */
  getOptionProps(index: number): ChoiceOptionProps;
  /** Callback ref for the Next button: it receives focus after each reveal. */
  setNextButton(element: HTMLButtonElement | null): void;
  /** Callback ref for the round container (tabIndex={-1} and a label): focused on a new round. */
  setRoundElement(element: HTMLElement | null): void;
}

/**
 * React binding for the choice engine: state, keyboard shortcuts, focus handling and animation
 * hooks. The markup is the game's (or ChoiceBoard's); this hook owns behaviour only.
 */
export function useChoiceGame<R extends ChoiceRound>(
  options: UseChoiceGameOptions<R>,
): ChoiceGame<R> {
  const { config, restore, keyboard = true } = options;
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState(() => startChoice(config, restore));
  const [pending, setPending] = useState<number | null>(null);

  // Latest values for event handlers and timers. Handlers also write the state they produce, so
  // a second key press before React re-renders sees it.
  const latest = useRef({ state, pending, options, reducedMotion });
  useLayoutEffect(() => {
    latest.current = { state, pending, options, reducedMotion };
  });

  const nextElement = useRef<HTMLButtonElement | null>(null);
  const roundElement = useRef<HTMLElement | null>(null);
  // Focus only moves after the player did something, never on page load.
  const interacted = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = useCallback((updated: ChoiceState<R>, waiting: number | null) => {
    latest.current = { ...latest.current, state: updated, pending: waiting };
    setState(updated);
    setPending(waiting);
  }, []);

  const reveal = useCallback(
    (index: number) => {
      const { state: current, options: opts } = latest.current;
      const updated = pickOption(current, opts.config, index);
      commit(updated, null);
      if (updated !== current && updated.round && updated.answer) {
        opts.onReveal?.(updated.round, updated.answer, updated);
      }
    },
    [commit],
  );

  const pick = useCallback(
    (index: number) => {
      const current = latest.current;
      const round = current.state.round;
      if (current.state.phase !== "choosing" || current.pending !== null || !round) return;
      if (index < 0 || index >= round.options.length) return;
      interacted.current = true;
      current.options.onPick?.(round, index);
      const delay = current.reducedMotion ? 0 : Math.max(0, current.options.revealDelayMs ?? 0);
      if (delay === 0) {
        reveal(index);
        return;
      }
      commit(current.state, index);
      timer.current = window.setTimeout(() => reveal(index), delay);
    },
    [commit, reveal],
  );

  const next = useCallback(() => {
    const { state: current, options: opts } = latest.current;
    if (current.phase !== "revealed") return;
    interacted.current = true;
    const updated = nextRound(current, opts.config);
    commit(updated, null);
    if (updated.phase === "finished") opts.onFinish?.(updated);
  }, [commit]);

  // Focus: Next after a reveal, the round after moving on.
  useEffect(() => {
    if (!interacted.current) return;
    if (state.phase === "revealed") nextElement.current?.focus({ preventScroll: true });
    else if (state.phase === "choosing") roundElement.current?.focus({ preventScroll: true });
  }, [state.phase, state.index]);

  useEffect(() => {
    if (!keyboard) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      const { state: current, pending: waiting } = latest.current;
      if (waiting !== null) return;
      if (shouldIgnoreKeyTarget(event.target, event.key)) return;
      const action = keyToAction(event, current.phase, current.round?.options.length ?? 0);
      if (!action) return;
      event.preventDefault();
      if (action.type === "pick") pick(action.index);
      else next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyboard, pick, next]);

  const getOptionProps = useCallback(
    (index: number): ChoiceOptionProps => ({
      type: "button",
      onClick: () => pick(index),
      disabled: state.phase !== "choosing" || pending !== null,
      "aria-keyshortcuts": OPTION_KEYS[index]?.shortcuts ?? "",
      "data-option": index,
    }),
    [pick, state.phase, pending],
  );

  const setNextButton = useCallback((element: HTMLButtonElement | null) => {
    nextElement.current = element;
  }, []);
  const setRoundElement = useCallback((element: HTMLElement | null) => {
    roundElement.current = element;
  }, []);

  return {
    state,
    pending,
    reducedMotion,
    pick,
    next,
    getOptionProps,
    setNextButton,
    setRoundElement,
  };
}
