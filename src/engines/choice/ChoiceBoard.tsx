"use client";

import { Fragment, type ReactNode } from "react";
import { cx } from "@/frame/ui/cx";
import { OPTION_KEYS } from "./keyboard";
import type { ChoiceAnswer, ChoiceRound, ChoiceState } from "./state";
import type { ChoiceGame } from "./useChoiceGame";

/**
 * How an option looks right now.
 * idle: waiting for a pick. pending: picked, reveal on its way. After the reveal: right (picked,
 * correct), wrong (picked, not correct), answer (the correct one, not picked), other.
 */
export type ChoiceOptionStatus = "idle" | "pending" | "right" | "wrong" | "answer" | "other";

export interface ChoiceOptionContext<R extends ChoiceRound> {
  round: R;
  option: R["options"][number];
  index: number;
  status: ChoiceOptionStatus;
  revealed: boolean;
  /** "A", "B" or "C". */
  keyHint: string;
}

export interface ChoiceRevealContext<R extends ChoiceRound> {
  round: R;
  answer: ChoiceAnswer;
  state: ChoiceState<R>;
}

export interface ChoiceBoardProps<R extends ChoiceRound> {
  game: ChoiceGame<R>;
  /** Accessible name of the round, e.g. "Pair 3 of 10". */
  roundLabel: (state: ChoiceState<R>) => string;
  /** Inside each option's button. */
  renderOption: (ctx: ChoiceOptionContext<R>) => ReactNode;
  optionClassName?: (ctx: ChoiceOptionContext<R>) => string;
  /** Layout of the option buttons (stacked, side by side…). */
  optionsClassName?: string;
  /** Shown once the answer is in. */
  renderReveal?: (ctx: ChoiceRevealContext<R>) => ReactNode;
  /** Text of the Next button, e.g. "Next pair" or "See the receipt". */
  nextLabel: (state: ChoiceState<R>) => ReactNode;
  nextClassName?: string;
  /** Read out after each reveal: the result and the facts behind it. */
  announce: (ctx: ChoiceRevealContext<R>) => string;
  /** Above the options (a question, a sign…). */
  header?: ReactNode;
  /** Between two options, e.g. "or". */
  separator?: ReactNode;
  className?: string;
}

export function optionStatus(
  index: number,
  answer: ChoiceAnswer | null,
  pending: number | null,
): ChoiceOptionStatus {
  if (!answer) return pending === index ? "pending" : "idle";
  if (answer.picked === index) return answer.correct ? "right" : "wrong";
  return index === answer.right ? "answer" : "other";
}

/**
 * The default layout of a choice round: the options as real buttons, the reveal, the Next button
 * and a polite live region. Everything visible comes from the game through render slots.
 */
export function ChoiceBoard<R extends ChoiceRound>({
  game,
  roundLabel,
  renderOption,
  optionClassName,
  optionsClassName,
  renderReveal,
  nextLabel,
  nextClassName,
  announce,
  header,
  separator,
  className,
}: ChoiceBoardProps<R>) {
  const { state, pending, next, getOptionProps, setNextButton, setRoundElement } = game;
  const { round, answer } = state;
  const revealed = state.phase !== "choosing" && answer !== null;
  const revealCtx = revealed && round && answer ? { round, answer, state } : null;

  return (
    <section
      ref={setRoundElement}
      tabIndex={-1}
      aria-label={roundLabel(state)}
      data-phase={state.phase}
      data-pending={pending ?? undefined}
      className={cx("outline-none", className)}
    >
      {header}
      {round && (
        <div className={optionsClassName}>
          {round.options.map((option, index) => {
            const ctx: ChoiceOptionContext<R> = {
              round,
              option,
              index,
              status: optionStatus(index, answer, pending),
              revealed,
              keyHint: OPTION_KEYS[index]?.hint ?? "",
            };
            return (
              <Fragment key={`${round.id}-${index}`}>
                {index > 0 && separator}
                <button
                  {...getOptionProps(index)}
                  data-status={ctx.status}
                  className={optionClassName?.(ctx)}
                >
                  {renderOption(ctx)}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}
      {revealCtx && renderReveal?.(revealCtx)}
      {state.phase === "revealed" && (
        <button type="button" ref={setNextButton} onClick={next} className={nextClassName}>
          {nextLabel(state)}
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {revealCtx ? announce(revealCtx) : ""}
      </p>
    </section>
  );
}
