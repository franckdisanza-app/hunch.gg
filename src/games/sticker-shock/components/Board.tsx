"use client";

import { useEffect, useRef } from "react";
import { ChoiceBoard } from "@/engines/choice/ChoiceBoard";
import type { ChoiceState } from "@/engines/choice/state";
import type { ChoiceGame } from "@/engines/choice/useChoiceGame";
import { cx } from "@/frame/ui/cx";
import { formatCurrency } from "@/lib/format";
import type { DayRates } from "../content.schema";
import type { DisplayCurrency } from "../pricing";
import { displayAmount, type PriceRound } from "../rounds";
import { strings } from "../strings";
import { announcement } from "../text";
import { CutLine } from "./Bits";
import { PriceCard } from "./PriceCard";
import { PriceReveal } from "./PriceReveal";
import styles from "./world.module.css";

export interface BoardProps {
  game: ChoiceGame<PriceRound>;
  currency: DisplayCurrency;
  rates: Readonly<Record<string, DayRates>>;
  roundLabel: (state: ChoiceState<PriceRound>) => string;
  nextLabel: (state: ChoiceState<PriceRound>) => string;
  /** The ID reports are filed under: the pair ID in dailies, a price ID in Endless. */
  reportId: (round: PriceRound) => string;
}

/**
 * One pair: two shelf labels, "or" between them, a short reveal, and Next in a bar pinned to the
 * bottom of the screen (two taps a pair, no scrolling).
 */
export function Board({ game, currency, rates, roundLabel, nextLabel, reportId }: BoardProps) {
  // A new pair starts at the top, even if the last reveal scrolled the page.
  const firstIndex = useRef(game.state.index);
  const { index } = game.state;
  const { reducedMotion } = game;
  useEffect(() => {
    if (index === firstIndex.current || window.scrollY === 0) return;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [index, reducedMotion]);

  const price = (round: PriceRound, index: number) => {
    const option = round.options[index as 0 | 1];
    return { price: option, amount: displayAmount(option, currency, rates) };
  };

  return (
    <ChoiceBoard
      game={game}
      roundLabel={roundLabel}
      className={cx("flex flex-col gap-5", styles.withBar)}
      optionsClassName="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4"
      separator={<CutLine />}
      optionClassName={() => styles.card!}
      renderOption={({ round, index, status, revealed, keyHint }) => {
        const { price: option, amount } = price(round, index);
        return (
          <PriceCard
            price={option}
            status={status}
            revealed={revealed}
            keyHint={keyHint}
            display={revealed ? { amount, currency } : null}
            tilt={index === 0 ? -7 : 5}
          />
        );
      }}
      renderReveal={({ round }) => (
        <PriceReveal round={round} itemId={reportId(round)} rates={rates} />
      )}
      nextLabel={nextLabel}
      nextClassName={cx(styles.bigButton, styles.display, "w-full")}
      actionBar={{
        className: styles.actionBar,
        idle: <p className={styles.actionHint}>{strings.pickHint}</p>,
      }}
      announce={({ round, answer }) =>
        announcement(
          answer.correct,
          round.options.map((option, i) => ({
            price: option,
            display: formatCurrency(price(round, i).amount, currency),
          })),
        )
      }
    />
  );
}

export const roundLabels = {
  daily: (state: ChoiceState<PriceRound>) =>
    strings.pairLabel(state.index + 1, state.total ?? state.index + 1),
  endless: (state: ChoiceState<PriceRound>) => strings.endlessPairLabel(state.index + 1),
};
