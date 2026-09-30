"use client";

import type { Route } from "next";
import { useMemo, useState } from "react";
import type { ChoiceConfig, ChoiceState } from "@/engines/choice/state";
import { summarize } from "@/engines/choice/summary";
import { useChoiceGame } from "@/engines/choice/useChoiceGame";
import { useGame } from "@/frame/GameContext";
import { ShareButton } from "@/frame/ShareButton";
import { Button, ButtonLink } from "@/frame/ui/Button";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { formatNumber } from "@/lib/format";
import { Tag } from "../art/Tag";
import { generatorPrice } from "../catalog";
import { poolSchema, type Pool, type PricedItem } from "../content.schema";
import { createEndlessDeck } from "../generator";
import { seededRandom } from "../random";
import { correctIndex, roundFromPair, type PriceRound } from "../rounds";
import { endlessShare } from "../share";
import { SOUNDS, registerSounds } from "../sounds";
import { strings } from "../strings";
import { receiptLine } from "../text";
import { useDisplayCurrency } from "../useDisplayCurrency";
import { useJson } from "../useJson";
import { SampleBanner, Sign } from "./Bits";
import { Board, roundLabels } from "./Board";
import { Header } from "./Header";
import { Receipt, type ReceiptLineData } from "./Receipt";
import { LoadingShelf, StateScreen } from "./States";
import styles from "./world.module.css";

const POOL_URL = "/api/games/sticker-shock/pool";
const DAILY_HREF = "/sticker-shock" as Route;
const REVEAL_DELAY_MS = 450;

function randomSeed(): string {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return `endless:${bytes[0]}:${bytes[1]}`;
}

/** Endless: random pairs until the first miss. Never touches daily stats or streaks. */
export function EndlessGame() {
  const pool = useJson(POOL_URL, poolSchema);
  // Each run gets a fresh random seed; "Play again" starts a new run.
  const [run, setRun] = useState(() => ({ n: 0, seed: randomSeed() }));

  if (pool.status === "loading") return <LoadingShelf title={strings.endlessHeading} />;
  if (pool.status !== "ready") {
    return (
      <StateScreen
        pose="wrong"
        title={strings.states.unavailable}
        body={strings.states.unavailableBody}
      >
        <Button variant="primary" size="lg" onClick={pool.retry}>
          {strings.states.retry}
        </Button>
      </StateScreen>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {pool.data.sample && <SampleBanner />}
      <EndlessRun
        key={run.n}
        pool={pool.data}
        seed={run.seed}
        onAgain={() => setRun({ n: run.n + 1, seed: randomSeed() })}
      />
    </div>
  );
}

function EndlessRun({ pool, seed, onAgain }: { pool: Pool; seed: string; onAgain: () => void }) {
  const { player, playSound } = useGame();
  const currency = useDisplayCurrency();
  const [over, setOver] = useState<ChoiceState<PriceRound> | null>(null);
  // Played rounds, for the receipt: the engine only keeps the current one.
  const [played, setPlayed] = useState<ReceiptLineData[]>([]);

  const config = useMemo((): ChoiceConfig<PriceRound> => {
    const priced = new Map<string, PricedItem>(pool.prices.map((p) => [p.id, p]));
    const deck = createEndlessDeck(
      pool.prices.map((p) => generatorPrice(p, pool.rates)),
      seededRandom(seed),
    );
    return {
      source: {
        kind: "generator",
        endOnMiss: true,
        next: (played) => {
          const pair = deck.next();
          return pair ? roundFromPair(pair, priced, played.length) : null;
        },
      },
      correctIndex,
    };
  }, [pool, seed]);

  const game = useChoiceGame({
    config,
    revealDelayMs: REVEAL_DELAY_MS,
    onPick() {
      registerSounds();
      playSound(SOUNDS.beep);
    },
    onReveal(round, answer, state) {
      if (state.answers.length === 1) player.start();
      playSound(answer.correct ? SOUNDS.right : SOUNDS.wrong);
      // The receipt grows with each right answer; the miss is its last line.
      const [a, b] = round.options;
      setPlayed((lines) => [
        ...lines,
        { key: round.id, text: receiptLine(lines.length, a, b), correct: answer.correct },
      ]);
    },
    onFinish(state) {
      const streak = summarize(state.answers).score;
      playSound(SOUNDS.print);
      player.complete({ answers: [], score: streak });
      setOver(state);
    },
  });

  const { state, pending } = game;

  if (over) {
    const streak = summarize(over.answers).score;
    return (
      <section className="flex flex-col items-center gap-5">
        <h1 className="sr-only">{strings.endlessHeading}</h1>
        <Tag pose="wrong" size={112} />
        <h2 className={cx(styles.display, "text-3xl")}>{strings.receipt.title}</h2>
        <Receipt
          header={strings.receipt.endlessHeader}
          lines={played}
          totals={[
            [strings.receipt.run, formatNumber(streak)],
            [strings.receipt.best, formatNumber(Math.max(player.unlimited.bestRun, streak))],
          ]}
          code={`RUN ${streak}`}
          footer={strings.receipt.torn}
          motion={game.reducedMotion ? "none" : "torn"}
        />
        <div className="flex w-full max-w-sm flex-col gap-3">
          <ShareButton getShare={() => endlessShare(streak)} className="w-full" />
          <Button size="lg" className="w-full" onClick={onAgain}>
            {strings.results.playAgain}
          </Button>
          <ButtonLink href={DAILY_HREF} size="lg" className="w-full">
            {strings.results.daily}
          </ButtonLink>
        </div>
      </section>
    );
  }

  const pose: MascotPose =
    pending !== null
      ? "thinking"
      : state.phase === "revealed" && state.answer
        ? state.answer.correct
          ? "correct"
          : "wrong"
        : "idle";
  const streak = summarize(state.answers).score;

  return (
    <div className="flex flex-col gap-5">
      <Header title={strings.endlessHeading} pose={pose} marks={[]}>
        <p className={cx(styles.mono, "flex gap-4 text-sm font-bold")}>
          <span>
            {strings.receipt.run} {formatNumber(streak)}
          </span>
          <span>{strings.results.bestRun(formatNumber(player.unlimited.bestRun))}</span>
        </p>
      </Header>
      <Sign />
      <Board
        game={game}
        currency={currency}
        rates={pool.rates}
        roundLabel={roundLabels.endless}
        nextLabel={(s) => (s.isLast ? strings.endlessOver : strings.next)}
        reportId={(round) => round.options[0].id}
      />
    </div>
  );
}
