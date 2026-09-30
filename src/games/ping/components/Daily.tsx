"use client";

import { useMemo, useState } from "react";
import * as z from "zod/mini";
import { startMap, summarizeMap, type MapAnswer, type SavedMapAnswer } from "@/engines/map/state";
import { useGame } from "@/frame/GameContext";
import { ResultsScreen } from "@/frame/ResultsScreen";
import { cx } from "@/frame/ui/cx";
import type { MascotPose } from "@/games/types";
import { getGame } from "@/games/registry";
import { sendGuess } from "@/lib/crowd/client";
import { deviceTimeZone, puzzleNumber } from "@/lib/daily";
import { formatNumber } from "@/lib/format";
import { Sonde } from "../art/Sonde";
import { DAILY_MAX, SCORING, roundFor, type Band } from "../config";
import { GAME_SLUG, dailyPuzzleSchema, type DailyPuzzle } from "../content.schema";
import { dailyShare } from "../share";
import { strings } from "../strings";
import { useDistanceUnit } from "../useDistanceUnit";
import { requestJson, useJson, type Prefetched } from "../useJson";
import { DraftBanner } from "./Bits";
import { Board } from "./Board";
import { BigLink, LoadingRadar, PRACTICE_HREF, StateScreen } from "./States";
import { Summary } from "./Summary";
import styles from "./world.module.css";

const savedSchema = z.array(
  z.object({
    roundId: z.string(),
    pins: z.array(z.tuple([z.number(), z.number()])),
  }),
);

/** Saved pins from history, or none when they do not parse. */
function savedPins(value: unknown): SavedMapAnswer[] {
  const parsed = z.safeParse(savedSchema, value);
  return parsed.success ? parsed.data : [];
}

/**
 * Today's questions, requested as soon as this module runs in the browser, before React
 * hydrates: the question is the largest thing on the page, so it should not wait for hydration.
 * Same puzzle number as GameShell's (local date); if they ever differ, useJson fetches anew.
 */
const early: Prefetched | null = (() => {
  const launchDate = getGame(GAME_SLUG)?.launchDate;
  if (typeof window === "undefined" || !launchDate) return null;
  const n = puzzleNumber(launchDate, Date.now(), deviceTimeZone());
  if (n < 1) return null;
  const url = `/api/puzzle/${GAME_SLUG}/${n}`;
  return { url, result: requestJson(url) };
})();

function scoreOf(answers: readonly MapAnswer<Band>[]): number {
  return summarizeMap(answers, SCORING).score;
}

/** Today's three questions: loads the day, then plays it, resumes it, or shows today's results. */
export function DailyGame() {
  const { puzzle, player } = useGame();
  const url = puzzle !== null && puzzle >= 1 ? `/api/puzzle/${GAME_SLUG}/${puzzle}` : null;
  const day = useJson(url, dailyPuzzleSchema, early);
  const [justFinished, setJustFinished] = useState(false);

  if (puzzle === null) return <LoadingRadar title={strings.name} />;
  if (puzzle < 1) {
    return (
      <StateScreen pose="point" title={strings.states.notLaunched}>
        <BigLink href={PRACTICE_HREF}>{strings.results.playPractice}</BigLink>
      </StateScreen>
    );
  }
  if (day.status === "loading") return <LoadingRadar title={strings.heading(puzzle)} />;
  if (day.status === "missing") {
    return (
      <StateScreen
        pose="thinking"
        title={strings.states.recalibrating}
        body={strings.states.recalibratingBody}
      >
        <BigLink href={PRACTICE_HREF} variant="primary">
          {strings.results.playPractice}
        </BigLink>
      </StateScreen>
    );
  }
  if (day.status === "error") {
    return (
      <StateScreen
        pose="wrong"
        title={strings.states.unavailable}
        body={strings.states.unavailableBody}
      >
        <button type="button" onClick={day.retry} className={cx(styles.bigButton, styles.primary)}>
          {strings.states.retry}
        </button>
        <BigLink href={PRACTICE_HREF}>{strings.results.playPractice}</BigLink>
      </StateScreen>
    );
  }

  const today = day.data;
  const entry = player.history[String(puzzle)];
  return (
    <div className="flex flex-col gap-4">
      {today.sample && <DraftBanner />}
      {entry?.finishedAt ? (
        <DailyResults day={today} saved={savedPins(entry.answers)} celebrate={justFinished} />
      ) : (
        <Board
          key={today.puzzle}
          questions={today.questions}
          title={strings.heading(today.puzzle)}
          restore={savedPins(entry?.answers)}
          onStart={() => player.start()}
          onProgress={(saved) => player.saveProgress(saved)}
          onQuestionDone={(question, answer) =>
            // Fire and forget: the first pin's distance, for difficulty tuning.
            sendGuess({
              game: GAME_SLUG,
              puzzle: today.puzzle,
              itemId: question.id,
              value: Math.round(answer.pins[0]!.km * 10) / 10,
            })
          }
          onFinish={(answers, saved) => {
            player.complete({ answers: saved, score: scoreOf(answers) });
            setJustFinished(true);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}

function DailyResults({
  day,
  saved,
  celebrate,
}: {
  day: DailyPuzzle;
  saved: SavedMapAnswer[];
  celebrate: boolean;
}) {
  const { player } = useGame();
  const unit = useDistanceUnit();
  const answers = useMemo(
    () => startMap({ rounds: day.questions.map(roundFor), scoring: SCORING }, saved).answers,
    [day, saved],
  );
  const score = scoreOf(answers);
  const pose: MascotPose =
    score >= DAILY_MAX * 0.66 ? "celebrate" : score >= DAILY_MAX / 3 ? "correct" : "wrong";
  return (
    <ResultsScreen
      game={GAME_SLUG}
      score={strings.results.score(formatNumber(score), formatNumber(DAILY_MAX))}
      streak={player.streak}
      summary={
        <div className="flex flex-col items-center gap-3">
          <h1 className="sr-only">{strings.heading(day.puzzle)}</h1>
          <Sonde pose={celebrate ? pose : "idle"} size={104} />
          <h2 className={cx(styles.display, "text-xl")}>{strings.results.title}</h2>
          <Summary questions={day.questions} answers={answers} unit={unit} />
        </div>
      }
      getShare={() => dailyShare(day, answers)}
      unlimitedHref={PRACTICE_HREF}
      unlimitedLabel={strings.unlimited}
    />
  );
}
