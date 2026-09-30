"use client";

import type { Route } from "next";
import { useMemo, useState } from "react";
import * as z from "zod/mini";
import { startChoice, type ChoiceConfig, type SavedChoiceAnswer } from "@/engines/choice/state";
import { summarize } from "@/engines/choice/summary";
import { useChoiceGame } from "@/engines/choice/useChoiceGame";
import { useGame } from "@/frame/GameContext";
import { OneTapPoll } from "@/frame/OneTapPoll";
import { ResultsScreen } from "@/frame/ResultsScreen";
import { Button } from "@/frame/ui/Button";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { sendGuess } from "@/lib/crowd/client";
import { formatIsoDate, formatNumber } from "@/lib/format";
import { Tag } from "../art/Tag";
import { dailyPuzzleSchema, type DailyPuzzle } from "../content.schema";
import { correctIndex, roundsFromDaily, type PriceRound } from "../rounds";
import { dailyShare } from "../share";
import { SOUNDS, registerSounds } from "../sounds";
import { strings } from "../strings";
import { receiptLine } from "../text";
import { useDisplayCurrency } from "../useDisplayCurrency";
import { useJson } from "../useJson";
import { SampleBanner, Sign } from "./Bits";
import { Board, roundLabels } from "./Board";
import { Header } from "./Header";
import { Receipt, type ReceiptLineData } from "./Receipt";
import { EndlessLink, LoadingShelf, StateScreen } from "./States";
import styles from "./world.module.css";

const SLUG = "sticker-shock";
const ENDLESS_HREF = "/sticker-shock/unlimited" as Route;
const REVEAL_DELAY_MS = 450;

const savedAnswersSchema = z.array(
  z.object({ roundId: z.string(), picked: z.int().check(z.nonnegative()) }),
);

function savedAnswers(value: unknown): SavedChoiceAnswer[] {
  const parsed = savedAnswersSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function configFor(day: DailyPuzzle): ChoiceConfig<PriceRound> {
  return { source: { kind: "list", rounds: roundsFromDaily(day) }, correctIndex };
}

function linesFor(day: DailyPuzzle, answers: readonly { correct: boolean }[]): ReceiptLineData[] {
  return answers.map((answer, i) => {
    const pair = day.pairs[i]!;
    return { key: pair.id, text: receiptLine(i, pair.a, pair.b), correct: answer.correct };
  });
}

/** The calendar date of puzzle n, for the receipt header. */
function puzzleDate(launchDate: string, puzzle: number): string {
  const [y, m, d] = launchDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + puzzle - 1));
  return date.toISOString().slice(0, 10);
}

/** Daily 10: loads today's shelf, then plays it, resumes it, or shows today's receipt. */
export function DailyGame() {
  const { puzzle, player } = useGame();
  const url = puzzle !== null && puzzle >= 1 ? `/api/puzzle/${SLUG}/${puzzle}` : null;
  const shelf = useJson(url, dailyPuzzleSchema);
  const [justFinished, setJustFinished] = useState(false);

  if (puzzle === null) {
    return <LoadingShelf title={strings.name} total={10} />;
  }
  if (puzzle < 1) {
    return (
      <StateScreen pose="point" title={strings.states.notLaunched}>
        <EndlessLink />
      </StateScreen>
    );
  }
  if (shelf.status === "loading") {
    return <LoadingShelf title={strings.heading(puzzle)} total={10} />;
  }
  if (shelf.status === "missing") {
    return (
      <StateScreen
        pose="point"
        title={strings.states.restocking}
        body={strings.states.restockingBody}
      >
        <EndlessLink />
      </StateScreen>
    );
  }
  if (shelf.status === "error") {
    return (
      <StateScreen
        pose="wrong"
        title={strings.states.unavailable}
        body={strings.states.unavailableBody}
      >
        <Button variant="primary" size="lg" onClick={shelf.retry}>
          {strings.states.retry}
        </Button>
        <EndlessLink />
      </StateScreen>
    );
  }

  const day = shelf.data;
  const entry = player.history[String(puzzle)];
  return (
    <div className="flex flex-col gap-5">
      {day.sample && <SampleBanner />}
      {entry?.finishedAt ? (
        <DailyResults day={day} saved={savedAnswers(entry.answers)} animate={justFinished} />
      ) : (
        <DailyPlay
          key={day.puzzle}
          day={day}
          restore={savedAnswers(entry?.answers)}
          onFinished={() => setJustFinished(true)}
        />
      )}
    </div>
  );
}

function DailyPlay({
  day,
  restore,
  onFinished,
}: {
  day: DailyPuzzle;
  restore: SavedChoiceAnswer[];
  onFinished: () => void;
}) {
  const { player, playSound } = useGame();
  const currency = useDisplayCurrency();
  const config = useMemo(() => configFor(day), [day]);

  const game = useChoiceGame({
    config,
    restore,
    revealDelayMs: REVEAL_DELAY_MS,
    onPick(_round, _index) {
      registerSounds();
      playSound(SOUNDS.beep);
    },
    onReveal(round, answer, state) {
      if (state.answers.length === 1 && restore.length === 0) player.start();
      playSound(answer.correct ? SOUNDS.right : SOUNDS.wrong);
      // Fire and forget: the crowd API never blocks play.
      sendGuess({
        game: SLUG,
        puzzle: day.puzzle,
        itemId: round.id,
        value: answer.correct ? 1 : 0,
      });
      player.saveProgress(state.answers.map(({ roundId, picked }) => ({ roundId, picked })));
    },
    onFinish(state) {
      playSound(SOUNDS.print);
      player.complete({
        answers: state.answers.map(({ roundId, picked }) => ({ roundId, picked })),
        score: summarize(state.answers).score,
      });
      onFinished();
    },
  });

  const { state, pending } = game;
  const pose: MascotPose =
    pending !== null
      ? "thinking"
      : state.phase === "revealed" && state.answer
        ? state.answer.correct
          ? "correct"
          : "wrong"
        : "idle";

  return (
    <div className="flex flex-col gap-5">
      <Header
        title={strings.heading(day.puzzle)}
        pose={pose}
        marks={state.answers.map((a) => a.correct)}
        total={day.pairs.length}
      />
      <Sign />
      <Board
        game={game}
        currency={currency}
        rates={day.rates}
        roundLabel={roundLabels.daily}
        nextLabel={(s) => (s.isLast ? strings.finish : strings.next)}
        reportId={(round) => round.id}
      />
    </div>
  );
}

function DailyResults({
  day,
  saved,
  animate,
}: {
  day: DailyPuzzle;
  saved: SavedChoiceAnswer[];
  animate: boolean;
}) {
  const { game, player } = useGame();
  const answers = useMemo(() => startChoice(configFor(day), saved).answers, [day, saved]);
  const summary = summarize(answers);
  const total = day.pairs.length;
  const pose: MascotPose =
    summary.score >= total - 1 ? "celebrate" : summary.score >= total / 2 ? "correct" : "wrong";
  const date = game.launchDate ? formatIsoDate(puzzleDate(game.launchDate, day.puzzle)) : "";
  const number = String(day.puzzle).padStart(4, "0");

  return (
    <ResultsScreen
      game={SLUG}
      score={`${summary.score}/${total}`}
      streak={player.streak}
      summaryShowsStats
      summary={
        <div className="flex flex-col items-center gap-4">
          <h1 className="sr-only">{strings.heading(day.puzzle)}</h1>
          <Tag pose={pose} size={112} />
          <h2 className={cx(styles.display, "text-3xl")}>{strings.receipt.title}</h2>
          <Receipt
            header={strings.receipt.header(number, date.toUpperCase())}
            lines={linesFor(day, answers)}
            totals={[
              [strings.receipt.score, `${summary.score}/${total}`],
              [strings.receipt.streak, formatNumber(player.streak)],
              [strings.receipt.best, formatNumber(player.stats.bestStreak)],
            ]}
            code={number}
            countdown
            motion={animate ? "slide-up" : "none"}
          />
        </div>
      }
      getShare={() => dailyShare(day, answers)}
      unlimitedHref={ENDLESS_HREF}
      unlimitedLabel={strings.endless}
      extras={
        day.poll && (
          <section className="rounded-sheet border-2 border-game-ink p-4">
            <h2 className="sr-only">{strings.poll.title}</h2>
            <OneTapPoll
              game={SLUG}
              pollId={`${SLUG}:${day.poll.id}`}
              question={day.poll.question}
              options={day.poll.options}
            />
          </section>
        )
      }
    />
  );
}
